#include "credentials.h"
#include <regex>
#include <sstream>
#include <iomanip>
#include <cctype>
#ifdef _WIN32
#include <windows.h>
#include <wincred.h>
#endif
using json = nlohmann::json;
namespace nextcloud_credentials {
static const std::wstring prefix = L"MarkdownViewer.Nextcloud.v1/";
static bool validId(const std::string& id) { return std::regex_match(id, std::regex("[a-f0-9]{64}")); }
static bool text(const json& a, const char* field, size_t maximum) {
    return a.contains(field) && a[field].is_string() && !a[field].get_ref<const std::string&>().empty() &&
        a[field].get_ref<const std::string&>().size() <= maximum && a[field].get_ref<const std::string&>().find('\0') == std::string::npos;
}
static bool valid(const json& a) {
    if(!a.is_object() || !text(a,"id",64) || !validId(a["id"]) || !text(a,"server",2048) ||
       !text(a,"userId",512) || !text(a,"loginName",512) || !text(a,"appPassword",4096)) return false;
    const std::string server = a["server"];
    if(!std::regex_match(server, std::regex(R"((https://[^/@?#\\\s]+|http://(127\.0\.0\.1|localhost)(:[0-9]+)?)(/[^?#\\\s]*)?)")) || server.back() == '/') return false;
    const std::string user = a["userId"];
    return user != "." && user != ".." && user.find_first_of("/\\\r\n") == std::string::npos && a["loginName"].get<std::string>().find(':') == std::string::npos;
}
static json metadata(const json& a) { return {{"id",a["id"]},{"server",a["server"]},{"userId",a["userId"]}}; }
static json error(const char* message) { return {{"error", {{"code","NEXTCLOUD_CREDENTIALS"},{"message",message}}}}; }
static std::wstring target(const std::string& id) { return prefix + std::wstring(id.begin(), id.end()); }
bool read(const std::string& id, json& account) {
#ifdef _WIN32
    if(!validId(id)) return false;
    PCREDENTIALW credential = nullptr;
    if(!CredReadW(target(id).c_str(), CRED_TYPE_GENERIC, 0, &credential)) return false;
    try {
        account = json::parse(credential->CredentialBlob, credential->CredentialBlob + credential->CredentialBlobSize);
    } catch(...) { CredFree(credential); return false; }
    CredFree(credential);
    return valid(account) && account["id"] == id;
#else
    return false;
#endif
}
static std::string encode(const std::string& value) {
    std::ostringstream out;
    for(unsigned char c: value) {
        if((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~' || c == '!' || c == '\'' || c == '(' || c == ')' || c == '*') out << c;
        else out << '%' << std::uppercase << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c);
    }
    return out.str();
}
bool permits(const json& a, const std::string& url, const std::string& method) {
    const std::string server = a["server"];
    if(method == "GET" && url == server + "/ocs/v2.php/cloud/user?format=json") return true;
    const std::string root = server + "/remote.php/dav/files/" + encode(a["userId"]) + "/";
    // Native URL scope supplements JS validation. Never forward stored credentials
    // to another origin, user-info URL, account root, redirect, or traversal path.
    if(url.rfind(root,0) != 0 || (method != "GET" && method != "PUT" && method != "PROPFIND" && method != "DELETE" && method != "MKCOL")) return false;
    auto suffix = url.substr(root.size());
    if(method=="MKCOL" && (suffix.empty() || suffix.back()!='/'))return false;
    if(suffix.find_first_of("?#\\\r\n") != std::string::npos) return false;
    std::string decoded;
    for(size_t i=0; i<suffix.size(); i++) {
        if(suffix[i] == '%') {
            if(i+2 >= suffix.size() || !std::isxdigit(static_cast<unsigned char>(suffix[i+1])) || !std::isxdigit(static_cast<unsigned char>(suffix[i+2]))) return false;
            const char c = static_cast<char>(std::stoi(suffix.substr(i+1,2),nullptr,16));
            if(c == '/' || c == '\\' || static_cast<unsigned char>(c) < 32) return false;
            decoded += c; i += 2;
        } else decoded += suffix[i];
    }
    if(method=="MKCOL" && decoded.find('%')!=std::string::npos)return false;
    if(method=="DELETE") {
        std::string lower=decoded;
        for(char& c:lower) if(c>='A' && c<='Z') c+='a'-'A';
        if(lower.size()<=3 || lower.substr(lower.size()-3)!=".md") return false;
    }
    std::istringstream parts(decoded); std::string part;
    while(std::getline(parts,part,'/')) if(part == "." || part == "..") return false;
    return true;
}
namespace controllers {
json store(const json& input) {
#ifdef _WIN32
    if(!valid(input)) return error("Invalid Nextcloud account.");
    const json account = {{"id",input["id"]},{"server",input["server"]},{"userId",input["userId"]},{"loginName",input["loginName"]},{"appPassword",input["appPassword"]}};
    auto serialized = account.dump();
    if(serialized.size() > CRED_MAX_CREDENTIAL_BLOB_SIZE) return error("The account exceeds the Windows credential size limit.");
    std::wstring name = target(account["id"]);
    CREDENTIALW credential = {};
    credential.Type = CRED_TYPE_GENERIC;
    credential.TargetName = name.data();
    credential.CredentialBlobSize = static_cast<DWORD>(serialized.size());
    credential.CredentialBlob = reinterpret_cast<LPBYTE>(serialized.data());
    credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
    const bool ok = CredWriteW(&credential,0);
    SecureZeroMemory(serialized.data(),serialized.size());
    if(!ok) return error("Windows could not securely remember this Nextcloud account.");
    return {{"success",true},{"returnValue",metadata(account)}};
#else
    return error("Secure Nextcloud accounts are available on Windows only.");
#endif
}
json list(const json&) {
    json result = json::array();
#ifdef _WIN32
    DWORD count = 0; PCREDENTIALW* credentials = nullptr;
    if(!CredEnumerateW((prefix + L"*").c_str(),0,&count,&credentials)) {
        if(GetLastError() == ERROR_NOT_FOUND) return {{"success",true},{"returnValue",result}};
        return error("Windows could not read remembered Nextcloud accounts.");
    }
    for(DWORD i=0; i<count; i++) {
        try {
            auto account = json::parse(credentials[i]->CredentialBlob,credentials[i]->CredentialBlob + credentials[i]->CredentialBlobSize);
            if(valid(account) && target(account["id"]) == credentials[i]->TargetName) result.push_back(metadata(account));
        } catch(...) { }
    }
    CredFree(credentials);
#endif
    return {{"success",true},{"returnValue",result}};
}
json forget(const json& input) {
#ifdef _WIN32
    if(!text(input,"id",64) || !validId(input["id"])) return error("Invalid Nextcloud account ID.");
    if(!CredDeleteW(target(input["id"]).c_str(),CRED_TYPE_GENERIC,0) && GetLastError() != ERROR_NOT_FOUND) return error("Windows could not forget this account.");
    return {{"success",true},{"returnValue",true}};
#else
    return error("Secure Nextcloud accounts are available on Windows only.");
#endif
}
}
}
