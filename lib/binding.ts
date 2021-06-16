import { translateFunction, FunctionType, SimpleFunctionType, KernelContext } from './parser';
import ObjectSerializer from './objectSerializer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu.node');

interface IGpgpuNative {
  createKernel(
    parserCode: string,
    types: string[],
    access: string[],
  ): (ksize: number[]) => (...args: unknown[]) => Promise<void>;
}

export function kernelFunction(returnObj: unknown, shapeObj: unknown) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value.shapeObj = shapeObj;
    descriptor.value.returnObj = returnObj;
  };
}

export function kernelEntry(typing: FunctionType[]) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value.typing = typing;
  };
}

export class Gpgpu {
  constructor() {
    this._addonInstance = new addon.Gpgpu();
    this._objSerializer = new ObjectSerializer();
  }

  createKernel(
    types: FunctionType[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: (this: KernelContext, ...args: any[]) => void,
    opt?: { functions?: SimpleFunctionType[] },
  ): { setSize: (ksize: number[]) => (...args: unknown[]) => Promise<void> } {
    const kernel = this._addonInstance.createKernel(
      translateFunction(
        func,
        types,
        types.flatMap((ft) => (ft.shapeObj ? [ft.shapeObj] : [])),
        opt?.functions ?? [],
      ),
      types.map((t) => t.type),
      types.map((t) => t.readWrite),
    );
    return {
      setSize: (ksize) => (...args) => {
        const serializedArgs = args.map((arg, i) => {
          if (types[i].type === 'Object') {
            return Buffer.concat(this._objSerializer.serializeObject(arg)[1]);
          }
          if (types[i].type === 'Object[]') {
            if (Array.isArray(arg)) {
              return Buffer.concat(arg.flatMap((x) => this._objSerializer.serializeObject(x)[1]));
            } else {
              throw new Error('Object[] must be an array');
            }
          }
          return arg;
        });
        return kernel(ksize)(...serializedArgs);
      },
    };
  }

  createKernel2(program: any): { setSize: (ksize: number[]) => (...args: unknown[]) => Promise<void> } {
    new program(); // This initialises program.prototype.main.typing etc.
    const func = program.prototype.main
    const types = program.prototype.main.typing;
    const functions = Object.getOwnPropertyNames(program.prototype).filter(item => typeof program.prototype[item] === 'function').filter(k => k !== 'constructor' && k !== 'main').map((f) => program.prototype[f]).map((f) => ({
      name: f.name,
      return: f.return,
      returnObj: f.returnObj,
      shape: f.shape,
      shapeObj: f.shapeObj,
      body: f,
    }))
    const kernel = this._addonInstance.createKernel(
      translateFunction(
        func,
        types,
        types.flatMap((ft: any) => (ft.shapeObj ? [ft.shapeObj] : [])),
        functions,
      ),
      types.map((t: any) => t.type),
      types.map((t: any) => t.readWrite),
    );
    return {
      setSize: (ksize) => (...args) => {
        const serializedArgs = args.map((arg, i) => {
          if (types[i].type === 'Object') {
            return Buffer.concat(this._objSerializer.serializeObject(arg)[1]);
          }
          if (types[i].type === 'Object[]') {
            if (Array.isArray(arg)) {
              return Buffer.concat(arg.flatMap((x) => this._objSerializer.serializeObject(x)[1]));
            } else {
              throw new Error('Object[] must be an array');
            }
          }
          return arg;
        });
        return kernel(ksize)(...serializedArgs);
      },
    };
  }

  // private members
  private _addonInstance: IGpgpuNative;
  private _objSerializer: ObjectSerializer;
}

export { KernelContext }
// export = Gpgpu;
// export default Gpgpu;
