// Windows adapter for the documented Neutralino extension protocol.
// No Neutralino headers, custom controllers, or runtime source are required.
#include <windows.h>
#include <winhttp.h>
#include <iostream>
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <mutex>
#include <chrono>
#include <condition_variable>
#include <set>
#include <array>
#include "providers.h"
using json = nlohmann::json;
static constexpr size_t LIMIT = 20 * 1024 * 1024;
static constexpr size_t IPC_LIMIT = 128 * 1024 * 1024;
struct Handle {
    HINTERNET value = nullptr;
    explicit Handle(HINTERNET h = nullptr): value(h) {}
    ~Handle() { if(value) WinHttpCloseHandle(value); }
    Handle(const Handle&) = delete;
    operator HINTERNET() const { return value; }
};
static void require(bool condition) { if(!condition) throw std::runtime_error("Cloud operation refused or unavailable."); }
static std::wstring wide(const std::string& value) {
    if(value.empty()) return {};
    int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), (int)value.size(), nullptr, 0);
    require(length > 0);
    std::wstring result(length, L'\0');
    require(MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), (int)value.size(), result.data(), length) == length);
    return result;
}
static std::string utf8(const std::wstring& value) {
    if(value.empty()) return {};
    int length = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), (int)value.size(), nullptr, 0, nullptr, nullptr);
    require(length > 0);
    std::string result(length, '\0');
    require(WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), (int)value.size(), result.data(), length, nullptr, nullptr) == length);
    return result;
}
static bool clean(const std::string& value) {
    for(unsigned char c:value) if(c < 32 || c == 127) return false;
    return true;
}
static std::string lower(std::string value) {
    for(char& c:value) if(c >= 'A' && c <= 'Z') c += 'a'-'A';
    return value;
}
static std::string basic(const std::string& value) {
    static const char* table="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    for(size_t i=0;i<value.size();i+=3) {
        unsigned a=(unsigned char)value[i], b=i+1<value.size()?(unsigned char)value[i+1]:0, c=i+2<value.size()?(unsigned char)value[i+2]:0;
        result += table[a>>2]; result += table[((a&3)<<4)|(b>>4)];
        result += i+1<value.size()?table[((b&15)<<2)|(c>>6)]:'=';
        result += i+2<value.size()?table[c&63]:'=';
    }
    return result;
}
// Async WinHTTP permits safe cancellation by closing the request handle. The
// context outlives HANDLE_CLOSING, including callbacks after deadline expiry.
struct AsyncRequest {
    HINTERNET handle=nullptr;
    std::mutex mutex;
    std::condition_variable changed;
    DWORD status=0,error=0,length=0;
    bool closed=false;
    std::array<char,16384> buffer;
    std::chrono::steady_clock::time_point deadline;
    static void CALLBACK callback(HINTERNET, DWORD_PTR context, DWORD status, LPVOID info, DWORD count) {
        auto* self=reinterpret_cast<AsyncRequest*>(context);
        if(!self)return;
        std::lock_guard<std::mutex> guard(self->mutex);
        if(status==WINHTTP_CALLBACK_STATUS_HANDLE_CLOSING)self->closed=true;
        else if(status==WINHTTP_CALLBACK_STATUS_REQUEST_ERROR)self->error=static_cast<WINHTTP_ASYNC_RESULT*>(info)->dwError;
        else if(status==WINHTTP_CALLBACK_STATUS_SENDREQUEST_COMPLETE || status==WINHTTP_CALLBACK_STATUS_HEADERS_AVAILABLE || status==WINHTTP_CALLBACK_STATUS_READ_COMPLETE) {
            self->status=status;self->length=count;
        }
        self->changed.notify_all();
    }
    AsyncRequest(HINTERNET connection,const std::wstring& method,const std::wstring& path,bool secure,std::chrono::steady_clock::time_point end):deadline(end) {
        handle=WinHttpOpenRequest(connection,method.c_str(),path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,secure?WINHTTP_FLAG_SECURE:0);
        require(handle);
        DWORD_PTR context=reinterpret_cast<DWORD_PTR>(this);
        if(!WinHttpSetOption(handle,WINHTTP_OPTION_CONTEXT_VALUE,&context,sizeof(context)) ||
           WinHttpSetStatusCallback(handle,callback,WINHTTP_CALLBACK_FLAG_ALL_COMPLETIONS|WINHTTP_CALLBACK_FLAG_HANDLES,0)==WINHTTP_INVALID_STATUS_CALLBACK) {
            WinHttpCloseHandle(handle);handle=nullptr;require(false);
        }
    }
    ~AsyncRequest() {
        if(!handle)return;
        WinHttpCloseHandle(handle);handle=nullptr;
        std::unique_lock<std::mutex> guard(mutex);
        changed.wait(guard,[&]{return closed;});
    }
    operator HINTERNET() const {return handle;}
    void prepare() {
        require(std::chrono::steady_clock::now()<deadline);
        std::lock_guard<std::mutex> guard(mutex);status=error=length=0;
    }
    DWORD wait(BOOL result,DWORD expected) {
        require(result || GetLastError()==ERROR_IO_PENDING);
        std::unique_lock<std::mutex> guard(mutex);
        require(changed.wait_until(guard,deadline,[&]{return error || status==expected;}));
        require(!error && std::chrono::steady_clock::now()<deadline);
        return length;
    }
};
static json request(const json& input) {
    cloud_providers::validate(input);
    const int timeout=input.value("timeoutMs",35000);require(timeout>=100 && timeout<=35000);
    const auto deadline=std::chrono::steady_clock::now()+std::chrono::milliseconds(timeout);
    const std::string url=input.at("url").get<std::string>(), method=input.at("method").get<std::string>();
    cloud_providers::validateRequest(input,url,method);
    require(url.size() <= 8192 && clean(url) && url.find_first_of("\\#") == std::string::npos);
    require(method=="GET" || method=="POST" || method=="PUT" || method=="PROPFIND" || method=="OPTIONS" || method=="DELETE" || method=="MKCOL");
    require(input.contains("maxBytes") && input["maxBytes"].is_number_integer());
    const auto maximum=input["maxBytes"].get<int64_t>(); require(maximum>0 && maximum<=LIMIT);
    const auto wurl=wide(url); URL_COMPONENTS parts{};parts.dwStructSize=sizeof(parts);
    parts.dwHostNameLength=parts.dwUrlPathLength=parts.dwExtraInfoLength=parts.dwUserNameLength=parts.dwPasswordLength=(DWORD)-1;
    require(WinHttpCrackUrl(wurl.c_str(), (DWORD)wurl.size(), 0, &parts));
    std::wstring host(parts.lpszHostName,parts.dwHostNameLength);
    require(parts.dwUserNameLength==0 && parts.dwPasswordLength==0);
    require(parts.nScheme==INTERNET_SCHEME_HTTPS || (parts.nScheme==INTERNET_SCHEME_HTTP && (host==L"localhost" || host==L"127.0.0.1" || host==L"[::1]" || host==L"::1")));
    std::wstring path=parts.dwUrlPathLength?std::wstring(parts.lpszUrlPath,parts.dwUrlPathLength):L"/";
    if(parts.dwExtraInfoLength) path.append(parts.lpszExtraInfo,parts.dwExtraInfoLength);
    json auth=input.value("auth", json::object());
    json account;
    if(auth.contains("credentialId")) {
        require(auth.size()==1 && auth["credentialId"].is_string());
        if(!cloud_providers::authorize(input,url,method,account))
            return {{"error",{{"code",input.value("providerId",std::string("nextcloud"))=="webdav"?"WEBDAV_CREDENTIALS":"NEXTCLOUD_CREDENTIALS"},{"message","Remembered access is unavailable for this account."}}}};
        auth=std::move(account);
    }
    const std::string body=input.value("body",std::string());require(body.size()<=LIMIT);
    auto headers=input.value("headers",json::object()); require(headers.is_object() && headers.size()<=32);
    const std::string contentType=input.value("contentType",std::string("application/json"));require(clean(contentType) && contentType.size()<=256);
    std::string headerText=method=="MKCOL" ? "" : "Content-Type: "+contentType+"\r\n";
    std::set<std::string> headerNames;
    bool conditional=false, createOnly=false;
    for(auto it=headers.begin();it!=headers.end();++it) {
        const auto name=it.key(), value=it.value().get<std::string>(), key=lower(name);
        require(!name.empty() && name.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")==std::string::npos && clean(value) && value.size()<=8192);
        require(key!="authorization" && key!="proxy-authorization" && key!="host" && key!="content-length" && key!="transfer-encoding" && key!="connection" && key!="cookie" && key!="content-type");
        require(headerNames.insert(key).second);
        if(key=="if-match") {
            require(value.size()>2 && value.front()=='"' && value.back()=='"' && value.substr(1,value.size()-2).find('"')==std::string::npos);
            conditional=true;
        }
        if(key=="if-none-match") { require(value=="*"); createOnly=true; }
        headerText+=name+": "+value+"\r\n";
    }
    if(method=="PUT") require(conditional != createOnly);
    if(method=="DELETE") require(conditional && !createOnly && body.empty());
    if(method=="MKCOL") require(createOnly && !conditional && body.empty() && parts.dwExtraInfoLength==0 && !path.empty() && path.back()==L'/');
    if((createOnly && method!="MKCOL") || method=="DELETE") {
        const auto targetPath=lower(utf8(path));
        require(parts.dwExtraInfoLength==0 && targetPath.size()>3 && targetPath.substr(targetPath.size()-3)==".md");
    }
    if(!auth.empty()) {
        const auto username=auth.at("username").get<std::string>(), password=auth.at("password").get<std::string>();
        require(!username.empty() && username.size()<=512 && username.find(':')==std::string::npos && clean(username) && !password.empty() && password.size()<=4096 && clean(password));
        headerText+="Authorization: Basic "+basic(username+":"+password)+"\r\n";
    }
    Handle session(WinHttpOpen(L"MarkdownViewerCloud/1",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,WINHTTP_FLAG_ASYNC)); require(session.value);
    require(WinHttpSetTimeouts(session,35000,35000,35000,35000));
    Handle connection(WinHttpConnect(session,host.c_str(),parts.nPort,0));require(connection.value);
    const auto wheaders=wide(headerText);
    AsyncRequest operation(connection,wide(method),path,parts.nScheme==INTERNET_SCHEME_HTTPS,deadline);
    DWORD redirectPolicy=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    require(WinHttpSetOption(operation,WINHTTP_OPTION_REDIRECT_POLICY,&redirectPolicy,sizeof(redirectPolicy)));
    DWORD disabled=WINHTTP_DISABLE_COOKIES|WINHTTP_DISABLE_AUTHENTICATION;
    require(WinHttpSetOption(operation,WINHTTP_OPTION_DISABLE_FEATURE,&disabled,sizeof(disabled)));
    operation.prepare();
    operation.wait(WinHttpSendRequest(operation,wheaders.c_str(),(DWORD)wheaders.size(),body.empty()?WINHTTP_NO_REQUEST_DATA:(LPVOID)body.data(),(DWORD)body.size(),(DWORD)body.size(),reinterpret_cast<DWORD_PTR>(&operation)),WINHTTP_CALLBACK_STATUS_SENDREQUEST_COMPLETE);
    operation.prepare();
    operation.wait(WinHttpReceiveResponse(operation,nullptr),WINHTTP_CALLBACK_STATUS_HEADERS_AVAILABLE);
    DWORD status=0,size=sizeof(status);
    require(WinHttpQueryHeaders(operation,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&size,WINHTTP_NO_HEADER_INDEX));
    DWORD headerSize=0;
    WinHttpQueryHeaders(operation,WINHTTP_QUERY_RAW_HEADERS_CRLF,WINHTTP_HEADER_NAME_BY_INDEX,nullptr,&headerSize,WINHTTP_NO_HEADER_INDEX);
    require(headerSize>0 && headerSize<=256*1024);
    std::vector<wchar_t> raw(headerSize/sizeof(wchar_t)+1);
    require(WinHttpQueryHeaders(operation,WINHTTP_QUERY_RAW_HEADERS_CRLF,WINHTTP_HEADER_NAME_BY_INDEX,raw.data(),&headerSize,WINHTTP_NO_HEADER_INDEX));
    const auto responseHeaders=utf8(raw.data());json pairs=json::array();
    size_t start=responseHeaders.find("\r\n");
    while(start!=std::string::npos) {
        start+=2;const auto end=responseHeaders.find("\r\n",start);if(end==std::string::npos || end==start) break;
        const auto colon=responseHeaders.find(':',start);
        if(colon!=std::string::npos && colon<end) {
            auto name=responseHeaders.substr(start,colon-start), value=responseHeaders.substr(colon+1,end-colon-1);
            while(!value.empty() && value.front()==' ') value.erase(0,1);
            if(lower(name)=="content-encoding") require(lower(value)=="identity");
            if(lower(name)!="set-cookie") pairs.push_back({name,value});
        }
        start=end;
    }
    std::string result;auto* buffer=operation.buffer.data();DWORD received;
    for(;;) {
        require(std::chrono::steady_clock::now()<deadline);
        operation.prepare();
        received=operation.wait(WinHttpReadData(operation,buffer,(DWORD)operation.buffer.size(),nullptr),WINHTTP_CALLBACK_STATUS_READ_COMPLETE);
        if(!received) break;
        require(received<=(size_t)maximum-result.size());result.append(buffer,received);
    }
    wide(result); // Reject malformed UTF-8 before serialization; do not crash the IPC worker.
    SecureZeroMemory(headerText.data(),headerText.size());
    return {{"returnValue",{{"transportVersion",1},{"status",status},{"headers",pairs},{"body",result}}}};
}
static json dispatch(const json& call) {
    const auto operation=call.at("operation").get<std::string>();
    const auto input=call.value("input",json::object());
    if(operation=="request") return request(input);
    if(operation=="accountStore" || operation=="accountList" || operation=="accountForget") return cloud_providers::accounts(operation,input);
    if(operation=="capabilities") return {{"returnValue",{{"version",5},{"providerIds",json::array({"nextcloud","webdav"})},{"secureAccounts",true},{"conditionalWrites",true},{"requestDeadlineMs",35000}}}};
    throw std::runtime_error("Unsupported cloud operation.");
}
int main() {
    try {
        // Neutralino sends bootstrap JSON through stdin; never persist or log it.
        std::string bootstrap;char character;
        while(std::cin.get(character)) {if(character=='\n')break;require(bootstrap.size()<16384);bootstrap+=character;}
        auto config=json::parse(bootstrap);
        require(config.at("nlExtensionId")=="com.markdownviewer.cloud");
        const auto port=std::stoi(config.at("nlPort").get<std::string>());require(port>0 && port<=65535);
        const auto token=config.at("nlToken").get<std::string>(), connectToken=config.at("nlConnectToken").get<std::string>();
        require(clean(connectToken) && connectToken.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_")==std::string::npos);
        Handle session(WinHttpOpen(L"MarkdownViewerExtension/1",WINHTTP_ACCESS_TYPE_NO_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0));require(session.value);
        Handle connection(WinHttpConnect(session,L"127.0.0.1",(INTERNET_PORT)port,0));require(connection.value);
        const auto path=wide("/?extensionId=com.markdownviewer.cloud&connectToken="+connectToken);
        Handle upgrade(WinHttpOpenRequest(connection,L"GET",path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,0));require(upgrade.value);
        require(WinHttpSetOption(upgrade,WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET,nullptr,0));
        require(WinHttpSendRequest(upgrade,WINHTTP_NO_ADDITIONAL_HEADERS,0,WINHTTP_NO_REQUEST_DATA,0,0,0) && WinHttpReceiveResponse(upgrade,nullptr));
        Handle socket(WinHttpWebSocketCompleteUpgrade(upgrade,0));require(socket.value);
        // An inherited socket can survive its original server process on Windows.
        // Obtain the actual runtime PID over authenticated IPC, not the cmd.exe
        // launcher parent, and hold a process handle so PID reuse cannot fool us.
        const std::string hostRequest=json({{"id","cloudHostProcess"},{"method","app.getProcessId"},{"accessToken",token},{"data",json::object()}}).dump();
        require(WinHttpWebSocketSend(socket,WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,(PVOID)hostRequest.data(),(DWORD)hostRequest.size())==NO_ERROR);
        bool monitoringHost=false;
        std::mutex sendMutex;std::atomic<int> active{0};std::atomic<unsigned long> sequence{0};
        std::string message;char buffer[16384];
        for(;;) {
            DWORD received=0;WINHTTP_WEB_SOCKET_BUFFER_TYPE type;
            if(WinHttpWebSocketReceive(socket,buffer,sizeof(buffer),&received,&type)!=NO_ERROR || type==WINHTTP_WEB_SOCKET_CLOSE_BUFFER_TYPE) std::exit(0);
            require(type==WINHTTP_WEB_SOCKET_UTF8_FRAGMENT_BUFFER_TYPE || type==WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE);
            require(message.size()+received<=IPC_LIMIT);message.append(buffer,received);
            if(type!=WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE) continue;
            auto envelope=json::parse(message);message.clear();
            if(envelope.value("id",std::string())=="cloudHostProcess") {
                require(!monitoringHost);
                const auto& response=envelope.at("data");
                require(response.value("success",false) && response.contains("returnValue") && response["returnValue"].is_number_integer());
                const auto pid=response["returnValue"].get<int64_t>();
                require(pid>0 && pid<=MAXDWORD && pid!=GetCurrentProcessId());
                HANDLE hostProcess=OpenProcess(SYNCHRONIZE,FALSE,(DWORD)pid);
                if(!hostProcess) std::exit(0); // Host already gone: never become an orphan.
                monitoringHost=true;
                std::thread([hostProcess] {
                    const auto result=WaitForSingleObject(hostProcess,INFINITE);
                    CloseHandle(hostProcess);
                    // No logging, credential deletion or remote request on termination.
                    std::exit(result==WAIT_OBJECT_0?0:1);
                }).detach();
                continue;
            }
            if(envelope.value("event",std::string())!="cloudRequest") continue;
            const auto call=envelope.at("data");
            const auto id=call.at("id").get<std::string>();require(id.size()<=100 && clean(id));
            // Bound concurrent native work; errors never include request URLs, bodies or credentials.
            if(active.load()>=8 || (call.value("operation",std::string())=="shutdown" && active.load()!=0)) {
                json reply={{"id",id},{"error",{{"code","BUSY"},{"message","Cloud service is busy. Try again shortly."}}}};
                const auto wire=json({{"id",std::to_string(++sequence)},{"method","app.broadcast"},{"accessToken",token},{"data",{{"event","cloudResponse"},{"data",reply}}}}).dump();
                std::lock_guard<std::mutex> guard(sendMutex);
                require(WinHttpWebSocketSend(socket,WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,(PVOID)wire.data(),(DWORD)wire.size())==NO_ERROR);
                continue;
            }
            if(call.value("operation",std::string())=="shutdown") {
                require(active.load()==0);
                const auto wire=json({{"id",std::to_string(++sequence)},{"method","app.broadcast"},{"accessToken",token},{"data",{{"event","cloudResponse"},{"data",{{"id",id},{"returnValue",true}}}}}}).dump();
                {std::lock_guard<std::mutex> guard(sendMutex);WinHttpWebSocketSend(socket,WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,(PVOID)wire.data(),(DWORD)wire.size());}
                std::exit(0);
            }
            ++active;
            std::thread([&,call,id] {
                json reply;
                try { reply=dispatch(call); }
                catch(...) {reply={{"error",{{"code","CLOUD_EXTENSION"},{"message","Cloud operation failed. Your local draft was kept."}}}};}
                reply["id"]=id;
                json outgoing={{"id",std::to_string(++sequence)},{"method","app.broadcast"},{"accessToken",token},{"data",{{"event","cloudResponse"},{"data",reply}}}};
                const auto wire=outgoing.dump();
                --active;
                {std::lock_guard<std::mutex> guard(sendMutex);if(WinHttpWebSocketSend(socket,WINHTTP_WEB_SOCKET_UTF8_MESSAGE_BUFFER_TYPE,(PVOID)wire.data(),(DWORD)wire.size())!=NO_ERROR) std::exit(0);}
            }).detach();
        }
    } catch(...) { return 1; }
}
