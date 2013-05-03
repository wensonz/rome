#include <vector>
#include <sstream>
#include <string>
#include <iostream>

#include <node.h>
#include <v8.h>

typedef struct Frame {
    Frame () {};
    Frame (const std::string& path, v8::Handle<v8::Object> target, v8::Handle<v8::Object> source) { this->path = path; this->target = target; this->source = source; };
    std::string path;
    v8::Handle<v8::Object> target;
    v8::Handle<v8::Object> source;
} Frame;

    
v8::Handle<v8::Value> Merge(const v8::Arguments& args) {
    int count = 0;
    int length = 0;
    bool overwritten = true;
    std::string path;
    
    v8::HandleScope scope;

    v8::Handle<v8::Object> target;
    v8::Handle<v8::Value> item;
    v8::Handle<v8::Array> names;
    v8::Handle<v8::String> key;
    v8::Handle<v8::Value> value;
    
    std::vector<Frame> stack;

    if (args.Length() <= 1) {
        return scope.Close(v8::Undefined());
    }

    target = args[0]->ToObject();
    
    count = args.Length() - 1; // minus the first one, since it's the target
    item = args[count]; // the last one

    if (item->IsBoolean()) {
        overwritten = item->BooleanValue();
        count -= 1;
    }
    std::cout << ">>> Count: " << count << ", Overwritten: " << overwritten << std::endl;
   
    for (int i = 1; i <= count; i ++) {
        std::cout << ">>> Processing object " << i << " ..." << std::endl;
        item = args[i];
        stack.clear();
        stack.push_back(Frame("ROOT", target, item->ToObject()));
       
        while (stack.size() > 0) {
            Frame& frame = stack.back();
            names = frame.source->GetOwnPropertyNames();
            length = names->Length();
            std::cout << "  * Stack size: " << stack.size() << ", Properties: " << length << std::endl;
            
            for (int j = 0; j < length; ++ j) {
                key = names->Get(j)->ToString();
                value = frame.source->Get(key);

                if (!frame.target->HasOwnProperty(key)) {
                    std::cout << "  * Key " << std::string(*v8::String::Utf8Value(key)) << " does not exist in the target" << std::endl;
                    frame.target->Set(key, value);
                    continue;
                }
                
                if (value->IsObject() && frame.target->Get(key)->IsObject()) { // Simple Types
                    path = frame.path + "." + std::string(*v8::String::Utf8Value(key));
                    stack.push_back(Frame(
                        path,
                        frame.target->Get(key)->ToObject(),
                        value->ToObject()
                    ));
                    std::cout << "  * Key " << std::string(*v8::String::Utf8Value(key)) << " is object in both source and target, pushed into stack with path " << path << std::endl;
                    continue;
                }

                if (!overwritten) {
                    std::ostringstream oss;
                    oss << "Confliction has been detected on property " << frame.path << " when merging the " << i << "th param into the target";
                    v8::ThrowException(v8::Exception::Error(v8::String::New(oss.str().c_str())));
                    return scope.Close(v8::Undefined());
                }

                std::cout << "  * Key " << std::string(*v8::String::Utf8Value(key)) << " is of simple types, overwritten is enabled" << std::endl;
                frame.target->Set(key, value);
            }
            stack.pop_back();
        }
    }
    
    return scope.Close(v8::Undefined());
}

void Init(v8::Handle<v8::Object> exports, v8::Handle<v8::Object> module) {
    module->Set(v8::String::NewSymbol("exports"), 
                v8::FunctionTemplate::New(Merge)->GetFunction());
}

NODE_MODULE(native_object_merge, Init)
