#pragma once

#include <napi.h>
#define CL_TARGET_OPENCL_VERSION 120
#define CL_USE_DEPRECATED_OPENCL_1_2_APIS
#ifdef __APPLE__
#include <OpenCL/opencl.h>
#else
#include <CL/cl.h>
#endif

class Gpgpu : public Napi::ObjectWrap<Gpgpu> {
 public:
  Gpgpu(const Napi::CallbackInfo &);
  ~Gpgpu();
  Napi::Value CreateKernel(const Napi::CallbackInfo &);
  void handleError(const char *, int);
  void log(const char *, ...);
  void logTime(const char *);

  static Napi::Function GetClass(Napi::Env);

 private:
  cl_context _context;
  cl_command_queue _command_queue;
  cl_device_id deviceId = NULL;
};
