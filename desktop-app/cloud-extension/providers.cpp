// Registered credential policies. User metadata cannot register a provider.
#include "providers.h"
#include "credentials.h"
#include "webdav-credentials.h"
#include <stdexcept>
namespace cloud_providers {
using json=nlohmann::json;
void validate(const json& input) {
    if(!input.is_object() || (input.contains("providerId") && (!input["providerId"].is_string() || (input["providerId"]!="nextcloud" && input["providerId"]!="webdav"))))
        throw std::runtime_error("Unsupported cloud provider. Local drafts were kept.");
}
void validateRequest(const json& input,const std::string& url,const std::string& method) {
    validate(input);
    if(input.value("providerId",std::string("nextcloud"))=="webdav" && (!input.contains("root") || !input["root"].is_string() || !webdav_credentials::permits(input["root"],url,method)))
        throw std::runtime_error("The request is outside this WebDAV connection.");
}
bool authorize(const json& input, const std::string& url, const std::string& method, json& account) {
    validate(input);
    const auto& auth=input.at("auth");
    json record;
    if(input.value("providerId",std::string("nextcloud"))=="webdav") {
        if(!webdav_credentials::read(auth.at("credentialId"),record) || input.value("root",std::string())!=record["root"] || !webdav_credentials::permits(record["root"],url,method))return false;
    } else if(!nextcloud_credentials::read(auth.at("credentialId"),record) || !nextcloud_credentials::permits(record,url,method))return false;
    // Translate the provider-specific vault record at this boundary only.
    account={{"username",record["loginName"]},{"password",record["appPassword"]}};
    return true;
}
static json tagged(json result) {
    if(result.contains("returnValue")) {
        auto& value=result["returnValue"];
        if(value.is_array())for(auto& item:value)item["providerId"]="nextcloud";
        else if(value.is_object())value["providerId"]="nextcloud";
    }
    return result;
}
json accounts(const std::string& operation,const json& input) {
    validate(input);
    const auto provider=input.value("providerId",std::string("nextcloud"));
    if(provider=="webdav") {
        if(operation=="accountStore")return webdav_credentials::controllers::store(input);
        if(operation=="accountList")return webdav_credentials::controllers::list(input);
        if(operation=="accountForget")return webdav_credentials::controllers::forget(input);
    }
    if(operation=="accountList" && !input.contains("providerId")) {
        auto nextcloud=tagged(nextcloud_credentials::controllers::list(input));
        auto webdav=webdav_credentials::controllers::list(input);
        if(nextcloud.contains("error"))return nextcloud;
        if(webdav.contains("error"))return webdav;
        for(const auto& account:webdav["returnValue"])nextcloud["returnValue"].push_back(account);
        return nextcloud;
    }
    if(operation=="accountStore")return tagged(nextcloud_credentials::controllers::store(input));
    if(operation=="accountList")return tagged(nextcloud_credentials::controllers::list(input));
    if(operation=="accountForget")return nextcloud_credentials::controllers::forget(input);
    throw std::runtime_error("Unsupported cloud account operation.");
}
}
