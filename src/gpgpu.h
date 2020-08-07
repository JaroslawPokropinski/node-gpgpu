#pragma once

#include <napi.h>
#define CL_TARGET_OPENCL_VERSION 220
#define CL_USE_DEPRECATED_OPENCL_1_2_APIS
#ifdef __APPLE__
#include <OpenCL/opencl.h>
#else
#include <CL/cl.h>
#endif

class Gpgpu : public Napi::ObjectWrap<Gpgpu>
{
public:
    Gpgpu(const Napi::CallbackInfo &);
    ~Gpgpu();
    Napi::Value Greet(const Napi::CallbackInfo &);
    Napi::Value CreateKernel(const Napi::CallbackInfo &);

    static Napi::Function GetClass(Napi::Env);

private:
    std::string _greeterName;
    cl_context _context;
    cl_command_queue _command_queue;
    cl_device_id deviceId = NULL;
};
