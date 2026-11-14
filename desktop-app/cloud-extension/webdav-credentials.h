#pragma once
#include "vendor/json.hpp"
#include <string>
namespace webdav_credentials {
bool read(const std::string&,nlohmann::json&);
bool permits(const std::string&,const std::string&,const std::string&);
namespace controllers {
nlohmann::json store(const nlohmann::json&);
nlohmann::json list(const nlohmann::json&);
nlohmann::json forget(const nlohmann::json&);
}
}
