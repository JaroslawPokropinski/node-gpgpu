#include "gpgpu.h"

#include <stdarg.h>

#include <chrono>
#include <memory>
#include <thread>

using namespace Napi;

struct TsfnContext {
  TsfnContext(Napi::Env env) : deferred(Napi::Promise::Deferred::New(env)), env(env){};

  Napi::ThreadSafeFunction tsfn;
  Napi::Promise::Deferred deferred;
  Napi::Env env;
  std::thread nativeThread;
};

void Gpgpu::handleError(const Napi::Env &env, const char *msg, int code) {
  if (code != 0) {
    log(msg, code);
    Napi::Error::New(env, msg).ThrowAsJavaScriptException();
  }
}

void Gpgpu::log(const char *format, ...) {
  const char *rawCenv = std::getenv("CENV");
  if (rawCenv == nullptr) return;

  const std::string cenv = rawCenv;
  if (cenv == "DEBUG") {
    va_list argptr;
    va_start(argptr, format);
    vfprintf(stderr, format, argptr);
    va_end(argptr);
  }
}

void Gpgpu::logTime(const char *name) {
  static int64_t first =
    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();
  auto millisec_since_epoch =
    std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch()).count();

  log("[TIME] %s %d\n", name, millisec_since_epoch - first);
}

Gpgpu::Gpgpu(const Napi::CallbackInfo &info) : ObjectWrap(info) {
  logTime("Create Gpgpu");
  // Get platform and device information
  auto env = info.Env();
  cl_platform_id platform_id = NULL;
  cl_uint ret_num_devices;
  cl_uint ret_num_platforms;
  cl_int ret = clGetPlatformIDs(1, &platform_id, &ret_num_platforms);
  if (ret != CL_SUCCESS) {
    if (ret == -1001) {
      handleError(env, "No valid ICDs found\n", ret);
    } else {
      handleError(env, "clGetPlatformIDs failed with: %d\n", ret);
    }
  }

  ret = clGetDeviceIDs(platform_id, info[0].As<Napi::Number>().Int32Value(), 1, &deviceId, &ret_num_devices);

  // Create an OpenCL context
  this->_context = clCreateContext(NULL, 1, &deviceId, NULL, NULL, &ret);

  // Create a command queue
  this->_command_queue = clCreateCommandQueue(this->_context, deviceId, 0, &ret);
}

Gpgpu::~Gpgpu() {
  clFlush(_command_queue);
  clFinish(_command_queue);
  clReleaseContext(_context);
}

Napi::Value Gpgpu::CreateKernel(const Napi::CallbackInfo &info) {
  logTime("Start CreateKernel");
  const size_t FIRST_ARG_INDEX = 2;
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Wrong number of arguments").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "Failed to pass parsed code as a string").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[1].IsArray()) {
    Napi::TypeError::New(env, "Failed to pass types").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array typesNodeArr = info[1].As<Napi::Array>();
  std::shared_ptr<std::string[]> types(new std::string[typesNodeArr.Length()]);
  for (size_t i = 0; i < typesNodeArr.Length(); i++) {
    types[i] = typesNodeArr.Get(i).As<Napi::String>().Utf8Value();
  }

  if (!info[2].IsArray()) {
    Napi::TypeError::New(env, "Failed to pass object access privileges").ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array accessNodeArr = info[2].As<Napi::Array>();
  std::shared_ptr<std::string[]> access(new std::string[accessNodeArr.Length()]);
  for (size_t i = 0; i < accessNodeArr.Length(); i++) {
    access[i] = accessNodeArr.Get(i).As<Napi::String>().Utf8Value();
  }

  Napi::String func = info[0].As<Napi::String>();
  log("Got a function %s\n", func.Utf8Value().c_str());

  cl_int ret;
  const size_t codeLength = func.Utf8Value().length();

  std::unique_ptr<char[]> code(new char[codeLength + 1]);
  strcpy(code.get(), func.Utf8Value().c_str());

  const char *sources[] = {code.get()};

  cl_program program = clCreateProgramWithSource(_context, 1, sources, &codeLength, &ret);
  ret = clBuildProgram(program, 1, &deviceId, NULL, NULL, NULL);
  if (ret != CL_SUCCESS) {
    handleError(env, "clBuildProgram returned %d\n", ret);
    size_t len = 0;
    ret = clGetProgramBuildInfo(program, deviceId, CL_PROGRAM_BUILD_LOG, 0, NULL, &len);
    char *buffer = (char *)calloc(len, sizeof(char));
    ret = clGetProgramBuildInfo(program, deviceId, CL_PROGRAM_BUILD_LOG, len, buffer, NULL);
    handleError(env, "clGetProgramBuildInfo returned %d\n", ret);
    return (Napi::Value)Napi::Number::New(env, 1.0);
  }
  // Create the OpenCL kernel
  cl_kernel kernel = clCreateKernel(program, "kernelFunc", &ret);
  handleError(env, "clCreateKernel returned %d\n", ret);

  logTime("End clCreateKernel");

  return Napi::Function::New(env, [=](const CallbackInfo &info2) {
    logTime("Start promise function");
    if (!info2[0].IsArray()) {
      Napi::TypeError::New(env, "Bad kernel size").ThrowAsJavaScriptException();
      return env.Null();
    }

    if (info2.Length() > 1 && !info2[1].IsArray()) {
      Napi::TypeError::New(env, "Bad group size").ThrowAsJavaScriptException();
      return env.Null();
    }

    size_t kdim = info2[0].As<Napi::Array>().Length();
    std::shared_ptr<size_t[]> ksize(new size_t[kdim]);

    std::shared_ptr<size_t[]> groupSize(new size_t[kdim]);

    for (size_t i = 0; i < kdim; i++) {
      ksize[i] = info2[0].As<Napi::Array>().Get(i).As<Napi::Number>().Int64Value();
      groupSize[i] = (info2.Length() > 1) ? info2[1].As<Napi::Array>().Get(i).As<Napi::Number>().Int64Value() : 1;
    }

    auto lamb = [=](const CallbackInfo &info) {
      logTime("Start kernel function");
      auto env = info.Env();
      cl_int ret;
      cl_mem stackMemObj = clCreateBuffer(_context, CL_MEM_READ_WRITE, 0x4, NULL, &ret);
      handleError(env, "clCreateBuffer returned %d\n", ret);
      cl_mem stackSizeMemObj = clCreateBuffer(_context, CL_MEM_READ_WRITE, 8, NULL, &ret);
      handleError(env, "clCreateBuffer returned %d\n", ret);
      ret = clSetKernelArg(kernel, 0, sizeof(cl_mem), &stackMemObj);
      handleError(env, "clSetKernelArg returned %d\n", ret);
      ret = clSetKernelArg(kernel, 1, sizeof(cl_mem), &stackSizeMemObj);
      handleError(env, "clSetKernelArg returned %d\n", ret);

      // Set the arguments of the kernel
      std::shared_ptr<cl_mem[]> mem_objs(new cl_mem[info.Length()]);
      for (size_t i = 0; i < info.Length(); i++) {
        if (types[i] == "Float32Array" || types[i] == "Float64Array") {
          if (!info[i].IsTypedArray()) {
            Napi::TypeError::New(env, "Argument type doesnt match array").ThrowAsJavaScriptException();
            return env.Null();
          }
          Napi::ArrayBuffer tarr = info[i].As<TypedArray>().ArrayBuffer();
          mem_objs[i] = clCreateBuffer(_context, CL_MEM_READ_WRITE, tarr.ByteLength(), NULL, &ret);
          if (access[i] == "read" || access[i] == "readwrite") {
            ret = clEnqueueWriteBuffer(
              _command_queue, mem_objs[i], CL_TRUE, 0, tarr.ByteLength(), tarr.Data(), 0, NULL, NULL);
          }
          ret = clSetKernelArg(kernel, i + FIRST_ARG_INDEX, sizeof(cl_mem), &mem_objs[i]);
        } else if (types[i] == "Object[]") {
          if (!info[i].IsBuffer()) {
            Napi::TypeError::New(env, "Argument type doesnt match object").ThrowAsJavaScriptException();
            return env.Null();
          }
          Napi::Buffer<char> obj = info[i].As<Napi::Buffer<char>>();
          mem_objs[i] = clCreateBuffer(_context, CL_MEM_READ_WRITE, obj.ByteLength(), NULL, &ret);
          if (access[i] == "read" || access[i] == "readwrite") {
            ret = clEnqueueWriteBuffer(
              _command_queue, mem_objs[i], CL_TRUE, 0, obj.ByteLength(), obj.Data(), 0, NULL, NULL);
          }
          ret = clSetKernelArg(kernel, i + FIRST_ARG_INDEX, sizeof(cl_mem), &mem_objs[i]);
        } else if (types[i] == "Object") {
          if (!info[i].IsBuffer()) {
            Napi::TypeError::New(env, "Argument type doesnt match object").ThrowAsJavaScriptException();
            return env.Null();
          }
          Napi::Buffer<char> obj = info[i].As<Napi::Buffer<char>>();
          log("bytes: %zd\n", obj.ByteLength());
          //    ret = clSetKernelArg(kernel, i + FIRST_ARG_INDEX,
          //    obj.ByteLength(), obj.Data());
          mem_objs[i] = clCreateBuffer(_context, CL_MEM_READ_WRITE, obj.ByteLength(), NULL, &ret);
          handleError(env, "clCreateBuffer returned: %d\n", ret);
          if (access[i] == "read" || access[i] == "readwrite") {
            ret = clEnqueueWriteBuffer(
              _command_queue, mem_objs[i], CL_TRUE, 0, obj.ByteLength(), obj.Data(), 0, NULL, NULL);
            handleError(env, "clEnqueueWriteBuffer returned: %d\n", ret);
          }
          ret = clSetKernelArg(kernel, i + FIRST_ARG_INDEX, sizeof(cl_mem), &mem_objs[i]);
          log("clSetKernelArg returned: %d\n", ret);
        } else {
          Napi::TypeError::New(env, "Bad argument type").ThrowAsJavaScriptException();
          return env.Null();
        }

        handleError(env, "clSetKernelArg returned %d\n", ret);
      }

      // Execute the OpenCL kernel on the list
      int eventsLength = info.Length() + 1;
      std::shared_ptr<cl_event[]> events(new cl_event[eventsLength]);

      ret =
        clEnqueueNDRangeKernel(_command_queue, kernel, kdim, NULL, ksize.get(), groupSize.get(), 0, NULL, &events[0]);

      handleError(env, "clEnqueueNDRangeKernel returned %d\n", ret);

      log("Create promise\n");

      size_t infoLength = info.Length();
      std::shared_ptr<void *[]> outputs(new void *[infoLength]);
      std::shared_ptr<size_t[]> outputsLengths(new size_t[infoLength]);
      for (size_t i = 0; i < infoLength; i++) {
        if (access[i] == "write" || access[i] == "readwrite") {
          Napi::ArrayBuffer tarr = info[i].As<TypedArray>().ArrayBuffer();
          outputs[i] = tarr.Data();
          outputsLengths[i] = tarr.ByteLength();
        }
      }

      auto waitForKernelContext = new TsfnContext(info.Env());
      auto waitForReadContext = new TsfnContext(info.Env());
      using Fn = void (*)(Napi::Env, void *, TsfnContext *);
      auto finalizerCallback = [=](Napi::Env env, void *finalizeData, TsfnContext *context) {
        logTime("Start finalizerCallback");
        context->nativeThread.join();
        //    context->deferred.Resolve(Napi::Boolean::New(env,
        //    true));
        cl_int ret;
        for (size_t i = 0; i < infoLength; i++) {
          if (access[i] == "write" || access[i] == "readwrite") {
            // Napi::ArrayBuffer tarr =
            // info[i].As<TypedArray>().ArrayBuffer(); float *a =
            // (float *)malloc(tarr.ByteLength());
            ret = clEnqueueReadBuffer(
              _command_queue, mem_objs[i], CL_FALSE, 0, outputsLengths[i], outputs[i], 0, NULL, &events[i + 1]);
            handleError(env, "clEnqueueReadBuffer returned %d\n", ret);
          }
        }
        delete context;

        waitForReadContext->tsfn = Napi::ThreadSafeFunction::New(
          env, Napi::Function::New(env, [](const CallbackInfo &info) { return info.Env().Null(); }), "TSFN2", 0, 1,
          waitForReadContext,
          [=](Napi::Env env, void *finalizeData, TsfnContext *context) {
            logTime("Start TSFN2");
            context->nativeThread.join();
            context->deferred.Resolve(Napi::Boolean::New(env, true));
            delete context;
            logTime("End TSFN2");
          },
          (void *)nullptr);

        waitForReadContext->nativeThread = std::thread([=]() {
          clFinish(_command_queue);

          waitForReadContext->tsfn.Release();
          logTime("End waiting for TSFN2");
        });
        logTime("End finalizerCallback");
      };
      waitForKernelContext->tsfn = Napi::ThreadSafeFunction::New(env,
        Napi::Function::New(info.Env(), [](const CallbackInfo &info) { return info.Env().Null(); }), "TSFN", 0, 1,
        waitForKernelContext, finalizerCallback, (void *)nullptr);

      waitForKernelContext->nativeThread = std::thread([=]() {
        clFinish(_command_queue);

        waitForKernelContext->tsfn.Release();
        logTime("End waiting for TSFN");
      });

      log("Ending kernel function\n");
      logTime("End kernel function");

      return (Napi::Value)waitForReadContext->deferred.Promise();
    };
    logTime("End promise function");

    return Napi::Function::New(env, lamb).As<Napi::Value>();
  });

  clReleaseKernel(kernel);
  clReleaseProgram(program);

  logTime("End CreateKernel");

  return func;
}

Napi::Function Gpgpu::GetClass(Napi::Env env) {
  return DefineClass(env, "Gpgpu",
    {
      Gpgpu::InstanceMethod("createKernel", &Gpgpu::CreateKernel),
    });
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  Napi::String name = Napi::String::New(env, "Gpgpu");
  exports.Set(name, Gpgpu::GetClass(env));
  return exports;
}

NODE_API_MODULE(addon, Init)
