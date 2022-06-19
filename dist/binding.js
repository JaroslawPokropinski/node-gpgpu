"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KernelContext = exports.Gpgpu = exports.DeviceType = exports.kernelEntry = exports.kernelFunction = exports.Types = void 0;
const parser_1 = require("./parser");
Object.defineProperty(exports, "KernelContext", { enumerable: true, get: function () { return parser_1.KernelContext; } });
const objectSerializer_1 = require("./objectSerializer");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu.node');
exports.Types = {
    number: 1,
    boolean: true,
};
function kernelFunction(returnObj, shapeObj) {
    return function (_target, _propertyKey, descriptor) {
        const v = descriptor.value;
        v.shapeObj = shapeObj;
        v.returnObj = returnObj;
    };
}
exports.kernelFunction = kernelFunction;
function kernelEntry(typing) {
    // type Types = { [Key in keyof typeof typing]: Key extends Float32ArrKernelArg ? Float32Array : undefined };
    // return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): void {
    return function (_target, _propertyKey, descriptor) {
        const v = descriptor.value;
        v.typing = typing;
    };
}
exports.kernelEntry = kernelEntry;
var DeviceType;
(function (DeviceType) {
    DeviceType[DeviceType["default"] = 1] = "default";
    DeviceType[DeviceType["gpu"] = 2] = "gpu";
    DeviceType[DeviceType["cpu"] = 4] = "cpu";
})(DeviceType = exports.DeviceType || (exports.DeviceType = {}));
class Gpgpu {
    constructor(device = DeviceType.default) {
        this.setSize = (ksize, gsize, types, kernel) => (...args) => {
            const serializedArgs = args.map((arg, i) => {
                if (types[i].type === 'Object') {
                    return Buffer.concat(this._objSerializer.serializeObject(arg)[1]);
                }
                if (types[i].type === 'Object[]') {
                    if (Array.isArray(arg)) {
                        return Buffer.concat(arg.flatMap((x) => this._objSerializer.serializeObject(x)[1]));
                    }
                    else {
                        throw new Error('Object[] must be an array');
                    }
                }
                return arg;
            });
            return kernel(ksize, gsize !== null && gsize !== void 0 ? gsize : ksize.map(() => 1))(...serializedArgs);
        };
        this._addonInstance = new addon.Gpgpu(device);
        this._objSerializer = new objectSerializer_1.default();
    }
    createFuncKernel(types, func, opt) {
        var _a;
        const kernel = this._addonInstance.createKernel((0, parser_1.translateFunction)(func, types, types.flatMap((ft) => (ft.type === 'Object' || ft.type === 'Object[]' ? [ft.shapeObj] : [])), (_a = opt === null || opt === void 0 ? void 0 : opt.functions) !== null && _a !== void 0 ? _a : []), types.map((t) => t.type), types.map((t) => t.readWrite));
        return {
            setSize: (ksize, gsize) => this.setSize(ksize, gsize !== null && gsize !== void 0 ? gsize : null, types, kernel),
            // (...args) =>  {
            //   const serializedArgs = args.map((arg, i) => {
            //     if (types[i].type === 'Object') {
            //       return Buffer.concat(this._objSerializer.serializeObject(arg)[1]);
            //     }
            //     if (types[i].type === 'Object[]') {
            //       if (Array.isArray(arg)) {
            //         return Buffer.concat(arg.flatMap((x) => this._objSerializer.serializeObject(x)[1]));
            //       } else {
            //         throw new Error('Object[] must be an array');
            //       }
            //     }
            //     return arg;
            //   });
            //   return kernel(ksize, gsize ?? ksize.map(() => 1))(...serializedArgs);
            // },
        };
    }
    getLastBuildInfo() {
        return this._addonInstance.getBuildInfo();
    }
    createClassKernel(program) {
        new program(); // This initialises program.prototype.main.typing etc.
        // disable no any to get values from program prototype
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyProgram = program;
        const func = program.prototype.main;
        const types = anyProgram.prototype.main.typing;
        const functions = Object.getOwnPropertyNames(program.prototype)
            .filter((item) => typeof anyProgram.prototype[item] === 'function')
            .filter((k) => k !== 'constructor' && k !== 'main')
            .map((f) => anyProgram.prototype[f])
            .map((f) => ({
            name: f.name,
            return: f.return,
            returnObj: f.returnObj,
            shape: f.shape,
            shapeObj: f.shapeObj,
            body: f,
        }));
        const kernel = this._addonInstance.createKernel((0, parser_1.translateFunction)(func, types, types.flatMap((ft) => ('shapeObj' in ft ? [ft.shapeObj] : [])), functions), types.map((t) => t.type), types.map((t) => t.readWrite));
        return {
            setSize: (ksize, gsize) => this.setSize(ksize, gsize !== null && gsize !== void 0 ? gsize : null, types, kernel),
            // (...args) => {
            //   const serializedArgs = args.map((arg, i) => {
            //     if (types[i].type === 'Object') {
            //       return Buffer.concat(this._objSerializer.serializeObject(arg)[1]);
            //     }
            //     if (types[i].type === 'Object[]') {
            //       if (Array.isArray(arg)) {
            //         return Buffer.concat(arg.flatMap((x) => this._objSerializer.serializeObject(x)[1]));
            //       } else {
            //         throw new Error('Object[] must be an array');
            //       }
            //     }
            //     return arg;
            //   });
            //   return kernel(ksize, gsize ?? ksize.map(() => 1))(...serializedArgs);
            // },
        };
    }
    createKernel(arg0, arg1, arg2) {
        if (Array.isArray(arg0) && arg1 != null) {
            return this.createFuncKernel(arg0, arg1, arg2);
        }
        if (!Array.isArray(arg0)) {
            return this.createClassKernel(arg0);
        }
        throw new Error();
    }
}
exports.Gpgpu = Gpgpu;
// export = Gpgpu;
// export default Gpgpu;
