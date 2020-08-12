#include "gpgpu.h"
#include <memory>

using namespace Napi;

Gpgpu::Gpgpu(const Napi::CallbackInfo &info) : ObjectWrap(info)
{
    // Get platform and device information
    cl_platform_id platform_id = NULL;
    cl_uint ret_num_devices;
    cl_uint ret_num_platforms;
    cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);
    if (ret != CL_SUCCESS)
    {
        if (ret == -1001)
        {
            printf("%s", "No valid ICDs found");
        }
        else
        {
            printf("clGetPlatformIDs failed with: %d", ret);
        }
    }

    ret = clGetDeviceIDs(platform_id, CL_DEVICE_TYPE_GPU, 1,
                         &deviceId, &ret_num_devices);

    // Create an OpenCL context
    this->_context = clCreateContext(NULL, 1, &deviceId, NULL, NULL, &ret);

    // Create a command queue
    this->_command_queue = clCreateCommandQueue(this->_context, deviceId, 0, &ret);
}

Gpgpu::~Gpgpu()
{
    clFlush(_command_queue);
    clFinish(_command_queue);
    clReleaseContext(_context);
}

Napi::Value Gpgpu::CreateKernel(const Napi::CallbackInfo &info)
{
    Napi::Env env = info.Env();

    if (info.Length() < 3)
    {
        Napi::TypeError::New(env, "Wrong number of arguments")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsString())
    {
        Napi::TypeError::New(env, "Failed to pass parsed code as a string")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[1].IsArray())
    {
        Napi::TypeError::New(env, "Failed to pass types")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array typesNodeArr = info[1].As<Napi::Array>();
    std::shared_ptr<std::string[]> types(new std::string[typesNodeArr.Length()]);
    for (size_t i = 0; i < typesNodeArr.Length(); i++)
    {
        types[i] = typesNodeArr.Get(i).As<Napi::String>().Utf8Value();
    }

    if (!info[2].IsArray())
    {
        Napi::TypeError::New(env, "Failed to pass object access privilages")
            .ThrowAsJavaScriptException();
        return env.Null();
    }
    Napi::Array accessNodeArr = info[2].As<Napi::Array>();
    std::shared_ptr<std::string[]> access(new std::string[accessNodeArr.Length()]);
    for (size_t i = 0; i < accessNodeArr.Length(); i++)
    {
        access[i] = accessNodeArr.Get(i).As<Napi::String>().Utf8Value();
    }

    Napi::String func = info[0].As<Napi::String>();
    printf("Got a function %s\n", func.Utf8Value().c_str());

    cl_int ret;
    const size_t codeLength = func.Utf8Value().length();

    std::unique_ptr<char[]> code(new char[codeLength + 1]);
    strcpy(code.get(), func.Utf8Value().c_str());

    const char *sources[] = {code.get()};

    cl_program program = clCreateProgramWithSource(_context, 1,
                                                   sources, &codeLength, &ret);
    ret = clBuildProgram(program, 1, &deviceId, NULL, NULL, NULL);
    if (ret != CL_SUCCESS)
    {
        printf("clBuildProgram returned %d\n", ret);
        size_t len = 0;
        ret = clGetProgramBuildInfo(program, deviceId, CL_PROGRAM_BUILD_LOG, 0, NULL, &len);
        char *buffer = (char *)calloc(len, sizeof(char));
        ret = clGetProgramBuildInfo(program, deviceId, CL_PROGRAM_BUILD_LOG, len, buffer, NULL);
        printf("clGetProgramBuildInfo returned %d\n", ret);
        printf("%s", buffer);
        return (Napi::Value)Napi::Number::New(env, 1.0);
    }
    // Create the OpenCL kernel
    cl_kernel kernel = clCreateKernel(program, "kernelFunc", &ret);
    printf("clCreateKernel returned %d\n", ret);

    return Napi::Function::New(env, [=](const CallbackInfo &info2) {
        if (!info2[0].IsArray())
        {
            Napi::TypeError::New(env, "Bad kernel size")
                .ThrowAsJavaScriptException();
            return env.Null();
        }

        if (info2.Length() > 1 && !info2[1].IsArray())
        {
            Napi::TypeError::New(env, "Bad group size")
                .ThrowAsJavaScriptException();
            return env.Null();
        }

        size_t kdim = info2[0].As<Napi::Array>().Length();
        std::shared_ptr<size_t[]> ksize(new size_t[kdim]);

        std::shared_ptr<size_t[]> groupSize(new size_t[kdim]);

        for (size_t i = 0; i < kdim; i++)
        {
            ksize[i] = info2[0].As<Napi::Array>().Get(i).As<Napi::Number>().Int64Value();
            groupSize[i] = (info2.Length() > 1) ? info2[1].As<Napi::Array>().Get(i).As<Napi::Number>().Int64Value() : 1;

            printf("Kernel size[0] set to %zd\n", ksize[i]);
        }

        return Napi::Function::New(env, [=](const CallbackInfo &info) {
                   printf("Calling kernel function\n");
                   cl_int ret;
                   // Set the arguments of the kernel
                   std::unique_ptr<cl_mem[]> mem_objs(new cl_mem[info.Length()]);
                   for (size_t i = 0; i < info.Length(); i++)
                   {
                       if (types[i] == "array")
                       {
                           if (!info[i].IsTypedArray())
                           {
                               Napi::TypeError::New(env, "Argument type doesnt match array")
                                   .ThrowAsJavaScriptException();
                               return env.Null();
                           }
                           Napi::ArrayBuffer tarr = info[i].As<TypedArray>().ArrayBuffer();
                           mem_objs[i] = clCreateBuffer(_context, CL_MEM_READ_WRITE,
                                                        tarr.ByteLength(), NULL, &ret);
                           if (access[i] == "read" || access[i] == "readwrite")
                           {
                               ret = clEnqueueWriteBuffer(_command_queue, mem_objs[i], CL_TRUE, 0,
                                                          tarr.ByteLength(), tarr.Data(), 0, NULL, NULL);
                           }
                       }
                       else if (types[i] == "object" || types[i] == "Object[]")
                       {
                           if (!info[i].IsBuffer())
                           {
                               Napi::TypeError::New(env, "Argument type doesnt match object")
                                   .ThrowAsJavaScriptException();
                               return env.Null();
                           }
                           Napi::Buffer<char> obj = info[i].As<Napi::Buffer<char>>();
                           mem_objs[i] = clCreateBuffer(_context, CL_MEM_READ_WRITE,
                                                        obj.ByteLength(), NULL, &ret);
                           if (access[i] == "read" || access[i] == "readwrite")
                           {
                               ret = clEnqueueWriteBuffer(_command_queue, mem_objs[i], CL_TRUE, 0,
                                                          obj.ByteLength(), obj.Data(), 0, NULL, NULL);
                           }
                       }
                       else
                       {
                           Napi::TypeError::New(env, "Bad argument type")
                               .ThrowAsJavaScriptException();
                           return env.Null();
                       }
                       ret = clSetKernelArg(kernel, i, sizeof(cl_mem), &mem_objs[i]);
                       printf("clSetKernelArg returned %d\n", ret);
                   }

                   // Execute the OpenCL kernel on the list
                   ret = clEnqueueNDRangeKernel(_command_queue, kernel, kdim, NULL,
                                                ksize.get(), groupSize.get(), 0, NULL, NULL);

                   printf("clEnqueueNDRangeKernel returned %d\n", ret);
                   // Read the memory buffer C on the device to the local variable C
                   for (size_t i = 0; i < info.Length(); i++)
                   {
                       // const char *type = arr.Get(0).As<Napi::String>().Utf8Value().c_str();
                       // printf("%s\n", type);
                       if (access[i] == "write" || access[i] == "readwrite")
                       {
                           Napi::ArrayBuffer tarr = info[i].As<TypedArray>().ArrayBuffer();
                           // float *a = (float *)malloc(tarr.ByteLength());
                           ret = clEnqueueReadBuffer(_command_queue, mem_objs[i], CL_TRUE, 0,
                                                     tarr.ByteLength(), tarr.Data(), 0, NULL, NULL);
                           printf("clEnqueueReadBuffer returned %d\n", ret);
                       }
                   }
                   printf("Ending kernel function\n");
                   return env.Null();
               })
            .As<Napi::Value>();
    });

    clReleaseKernel(kernel);
    clReleaseProgram(program);

    return func;
}

Napi::Function Gpgpu::GetClass(Napi::Env env)
{
    return DefineClass(env, "Gpgpu", {
                                         Gpgpu::InstanceMethod("createKernel", &Gpgpu::CreateKernel),
                                     });
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    Napi::String name = Napi::String::New(env, "Gpgpu");
    exports.Set(name, Gpgpu::GetClass(env));
    return exports;
}

NODE_API_MODULE(addon, Init)
