#define BUILDING_NODE_EXTENSION

#include <stack>

#include <node.h>
#include <v8.h>

void merge_(const std::vector<Json::Value>& objects, bool overwritten) {
    //
}

v8::Handle<v8::Value> Merge(const v8::Arguments& args) {
    v8::HandleScope scope;
    
    std::istringstream iss(*args[0]->ToString());
    bool overwritten = args.Length() > 1 ? args[1]->BooleanValue() : true;
    
    
    return scope.Close(v8::Undefined());
}

void Init(v8::Handle<v8::Object> exports, v8::Handle<v8::Object> module) {
    module->Set(v8::String::NewSymbol("exports"), 
                v8::FunctionTemplate::New(Merge)->GetFunction());
}

NODE_MODULE(native_object_merge, Init)



/*

#define BUILD_NODE_EXTENSION
#include <stack>

#include <node.h>
#include <v8.h>

void merge(v8::Handle<v8::Object> target, v8::Handle<v8::Object> source) {
    v8::HandleScope scope;
    v8::Handle<v8::Array> names = source->GetOwnPropertyNames();
    int length = names->Length();
    v8::Handle<v8::String> key;
    v8::Handle<v8::Value> value;

    for (int i = 0; i < length; ++ i) {
        key = names->Get(i)->ToString();
        value = source->Get(key);
        if (!target->HasOwnProperty(key)) {
            target->Set(key, value);
            continue;
        }
        if (value->IsNumber() || value->IsBoolean() || value->IsString() || value->IsDate() || value->IsArray()) { // Simple Types
            target->Set(key, value);
            continue;
        }

        merge(target->Get(key)->ToObject(), value->ToObject());
    }
}

v8::Handle<v8::Value> Merge(const v8::Arguments& args) {
    v8::HandleScope scope;

    merge(args[0]->ToObject(), args[1]->ToObject());

    return scope.Close(v8::Undefined());
}

void Init(v8::Handle<v8::Object> exports, v8::Handle<v8::Object> module) {
    module->Set(v8::String::NewSymbol("exports"), v8::FunctionTemplate::New(Merge)->GetFunction());
}

NODE_MODULE(fast_json_merge, Init)



*/