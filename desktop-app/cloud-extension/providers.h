#pragma once
#include "vendor/json.hpp"
#include <string>
namespace cloud_providers {
// Missing provider IDs are accepted only for the legacy Nextcloud IPC contract.
void validate(const nlohmann::json&);
void validateRequest(const nlohmann::json&,const std::string&,const std::string&);
bool authorize(const nlohmann::json&, const std::string&, const std::string&, nlohmann::json&);
nlohmann::json accounts(const std::string&, const nlohmann::json&);
}
