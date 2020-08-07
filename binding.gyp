{
    'targets': [
        {
            'target_name': 'gpgpu-native',
            'sources': ['src/gpgpu.cc'],
            'include_dirs': ["<!@(node -p \"require('node-addon-api').include\")"],
            'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
            'cflags!': ['-fno-exceptions'],
            'cflags_cc!': ['-fno-exceptions'],
            'xcode_settings': {
                'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
                'CLANG_CXX_LIBRARY': 'libc++',
                'MACOSX_DEPLOYMENT_TARGET': '10.7'
            },
            'msvs_settings': {
                'VCCLCompilerTool': {'ExceptionHandling': 1},
            },
            'conditions': [
                ['OS=="linux"', {
                    "libraries": ["-lOpenCL"]
                }],
                ['OS=="win"', {
                    'include_dirs': [
                        "$(CUDA_PATH)/include"
                    ],
                    "libraries": ["-l$(CUDA_PATH)/lib/x64/OpenCL"]
                }]
            ],
        }
    ]
}
