#include "webdav-credentials.h"
#include <regex>
#include <sstream>
#include <iomanip>
#include <cctype>
#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#include <wincred.h>
#endif
using json = nlohmann::json;
namespace webdav_credentials {
static const std::wstring prefix = L"MarkdownViewer.WebDAV.v1/";
static bool validId(const std::string& id) { return std::regex_match(id, std::regex("webdav-[a-f0-9]{64}")); }
static bool text(const json& a, const char* field, size_t maximum) {
    return a.contains(field) && a[field].is_string() && !a[field].get_ref<const std::string&>().empty() &&
        a[field].get_ref<const std::string&>().size() <= maximum && a[field].get_ref<const std::string&>().find('\0') == std::string::npos;
}
static bool safePath(const std::string& path) {
    std::string decoded;
    for(size_t i=0;i<path.size();i++) {
        unsigned char c=path[i];
        if(c=='%') {
            if(i+2>=path.size() || !std::isxdigit((unsigned char)path[i+1]) || !std::isxdigit((unsigned char)path[i+2]))return false;
            c=(unsigned char)std::stoi(path.substr(i+1,2),nullptr,16);i+=2;
            if(c=='/' || c=='\\')return false;
        }
        if(c<32 || c==127 || c=='\\')return false;
        decoded+=(char)c;
    }
    // Do not rely on a server to decode nested escape sequences exactly once.
    if(std::regex_search(decoded,std::regex("%[a-fA-F0-9]{2}")))return false;
    std::istringstream pieces(decoded);std::string piece;
    while(std::getline(pieces,piece,'/'))if(piece=="." || piece=="..")return false;
    return true;
}
static bool validRoot(const std::string& root) {
    if(root.empty() || root.size()>2048 || root.back()!='/' || root.find_first_of("?#\\\r\n\t ")!=std::string::npos)return false;
    const int size=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,root.data(),(int)root.size(),nullptr,0);
    if(size<=0)return false;
    std::wstring url(size,L'\0');MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,root.data(),(int)root.size(),url.data(),size);
    URL_COMPONENTS p{};p.dwStructSize=sizeof(p);p.dwHostNameLength=p.dwUserNameLength=p.dwPasswordLength=p.dwUrlPathLength=p.dwExtraInfoLength=(DWORD)-1;
    if(!WinHttpCrackUrl(url.c_str(),(DWORD)url.size(),0,&p) || p.dwUserNameLength || p.dwPasswordLength || p.dwExtraInfoLength || !p.dwHostNameLength)return false;
    const std::wstring host(p.lpszHostName,p.dwHostNameLength);
    if(p.nScheme!=INTERNET_SCHEME_HTTPS && !(p.nScheme==INTERNET_SCHEME_HTTP && (host==L"localhost" || host==L"127.0.0.1" || host==L"[::1]" || host==L"::1")))return false;
    const auto slash=root.find('/',root.find("://")+3);
    return slash!=std::string::npos && safePath(root.substr(slash));
}
static bool valid(const json& a) {
    if(!a.is_object() || a.value("providerId",std::string())!="webdav" || !text(a,"id",71) || !validId(a["id"]) || !text(a,"root",2048) ||
       !text(a,"username",512) || !text(a,"loginName",512) || !text(a,"appPassword",4096) || !a.contains("label") || !a["label"].is_string() || a["label"].get_ref<const std::string&>().size()>320)return false;
    const auto username=a["username"].get<std::string>();
    if(username.find(':')!=std::string::npos || a["loginName"]!=a["username"])return false;
    for(const char* field:{"username","appPassword","label"})for(unsigned char c:a[field].get_ref<const std::string&>())if(c<32 || c==127)return false;
    return validRoot(a["root"]);
}
static json metadata(const json& a) { return {{"providerId","webdav"},{"id",a["id"]},{"root",a["root"]},{"username",a["username"]},{"label",a["label"]}}; }
static json error(const char* message) { return {{"error", {{"code","WEBDAV_CREDENTIALS"},{"message",message}}}}; }
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
bool permits(const std::string& root,const std::string& url,const std::string& method) {
    if(!validRoot(root) || url.rfind(root,0)!=0 || url.find_first_of("?#\\\r\n")!=std::string::npos)return false;
    const auto suffix=url.substr(root.size());
    if(!safePath(suffix))return false;
    if(method=="MKCOL")return !suffix.empty() && suffix.back()=='/';
    if(method=="PROPFIND" || method=="OPTIONS")return true;
    std::string lower=suffix;for(char& c:lower)if(c>='A' && c<='Z')c+='a'-'A';
    const bool md=lower.size()>3 && lower.substr(lower.size()-3)==".md";
    const bool markdown=lower.size()>9 && lower.substr(lower.size()-9)==".markdown";
    return (method=="DELETE" && md) || ((method=="GET" || method=="PUT") && (md || markdown));
}
namespace controllers {
json store(const json& input) {
#ifdef _WIN32
    if(!valid(input)) return error("Invalid WebDAV account.");
    const json account = {{"providerId","webdav"},{"id",input["id"]},{"root",input["root"]},{"username",input["username"]},{"label",input["label"]},{"loginName",input["loginName"]},{"appPassword",input["appPassword"]}};
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
    if(!ok) return error("Windows could not securely remember this WebDAV account.");
    return {{"success",true},{"returnValue",metadata(account)}};
#else
    return error("Secure WebDAV accounts are available on Windows only.");
#endif
}
json list(const json&) {
    json result = json::array();
#ifdef _WIN32
    DWORD count = 0; PCREDENTIALW* credentials = nullptr;
    if(!CredEnumerateW((prefix + L"*").c_str(),0,&count,&credentials)) {
        if(GetLastError() == ERROR_NOT_FOUND) return {{"success",true},{"returnValue",result}};
        return error("Windows could not read remembered WebDAV accounts.");
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
    if(!text(input,"id",71) || !validId(input["id"])) return error("Invalid WebDAV account ID.");
    if(!CredDeleteW(target(input["id"]).c_str(),CRED_TYPE_GENERIC,0) && GetLastError() != ERROR_NOT_FOUND) return error("Windows could not forget this account.");
    return {{"success",true},{"returnValue",true}};
#else
    return error("Secure WebDAV accounts are available on Windows only.");
#endif
}
}
}
