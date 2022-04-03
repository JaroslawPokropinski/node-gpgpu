import {
  translateFunction,
  FunctionType,
  SimpleFunctionType,
  KernelContext,
  ObjectKernelArg,
  ObjectArrKernelArg,
} from './parser';
import ObjectSerializer from './objectSerializer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu.node');

interface IGpgpuNative {
  createKernel(
    parserCode: string,
    types: string[],
    access: string[],
  ): (ksize: number[], gsize: number[]) => (...args: unknown[]) => Promise<void>;
  getBuildInfo(): string;
}

export const Types = {
  number: 1,
  boolean: true,
};

export function kernelFunction<R, T extends unknown[]>(returnObj: R, shapeObj: [...T]) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: [...T]) => R>,
  ): void {
    const v = descriptor.value as unknown as { shapeObj: [...T]; returnObj: R };
    v.shapeObj = shapeObj;
    v.returnObj = returnObj;
  };
}

export function kernelEntry<T extends FunctionType[]>(typing: [...T]) {
  type ShapeObj<T> = T extends FunctionType
    ? T['type'] extends 'Float32Array'
      ? Float32Array
      : T['type'] extends 'Float64Array'
      ? Float64Array
      : T extends ObjectKernelArg
      ? T['shapeObj']
      : T extends ObjectArrKernelArg
      ? T['shapeObj']
      : T['type']
    : T;

  type Types = {
    [K in keyof T]: ShapeObj<T[K]>;
  };

  // type Types = { [Key in keyof typeof typing]: Key extends Float32ArrKernelArg ? Float32Array : undefined };
  // return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): void {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: [...Types]) => void>,
  ): void {
    const v = descriptor.value as unknown as { typing: FunctionType[] };
    v.typing = typing;
  };
}

export enum DeviceType {
  default = 1,
  gpu = 2,
  cpu = 4,
}

export class Gpgpu {
  constructor(device: DeviceType = DeviceType.default) {
    this._addonInstance = new addon.Gpgpu(device);
    this._objSerializer = new ObjectSerializer();
  }

  private setSize =
    (
      ksize: number[],
      gsize: number[] | null,
      types: FunctionType[],
      kernel: (ksize: number[], gsize: number[]) => (...args: unknown[]) => Promise<void>,
    ) =>
    (...args: unknown[]) => {
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
      return kernel(ksize, gsize ?? ksize.map(() => 1))(...serializedArgs);
    };

  createFuncKernel<T extends unknown[]>(
    types: FunctionType[],
    func: (this: KernelContext, ...args: [...T]) => void,
    opt?: { functions?: SimpleFunctionType[] },
  ): { setSize: (ksize: number[], gsize?: number[]) => (...args: unknown[]) => Promise<void> } {
    const kernel = this._addonInstance.createKernel(
      translateFunction(
        func,
        types,
        types.flatMap((ft) => (ft.type === 'Object' || ft.type === 'Object[]' ? [ft.shapeObj] : [])),
        opt?.functions ?? [],
      ),
      types.map((t) => t.type),
      types.map((t) => t.readWrite),
    );
    return {
      setSize: (ksize, gsize) => this.setSize(ksize, gsize ?? null, types, kernel),
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

  getLastBuildInfo(): string {
    return this._addonInstance.getBuildInfo();
  }

  createClassKernel<T extends KernelContext, Q extends unknown[]>(program: {
    new (): T;
    prototype: { main: (...args: [...Q]) => void };
  }): { setSize: (ksize: number[], gsize?: number[]) => (...args: Q) => Promise<void> } {
    new program(); // This initialises program.prototype.main.typing etc.

    // disable no any to get values from program prototype
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyProgram = program as any;
    const func = program.prototype.main;
    const types: FunctionType[] = anyProgram.prototype.main.typing;
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
    const kernel = this._addonInstance.createKernel(
      translateFunction(
        func,
        types,
        types.flatMap((ft) => ('shapeObj' in ft ? [ft.shapeObj] : [])),
        functions,
      ),
      types.map((t) => t.type),
      types.map((t) => t.readWrite),
    );
    return {
      setSize: (ksize, gsize) => this.setSize(ksize, gsize ?? null, types, kernel),
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

  createKernel<Q extends unknown[]>(
    types: FunctionType[],
    func: (this: KernelContext, ...args: [...Q]) => void,
    opt?: { functions?: SimpleFunctionType[] },
  ): { setSize: (ksize: number[], gsize?: number[]) => (...args: unknown[]) => Promise<void> };

  createKernel<T extends KernelContext, Q extends unknown[]>(program: {
    new (): T;
    prototype: { main: (...args: [...Q]) => void };
  }): { setSize: (ksize: number[], gsize?: number[]) => (...args: Q) => Promise<void> };
  createKernel<T extends KernelContext, Q extends unknown[]>(
    arg0:
      | {
          new (): T;
          prototype: { main: (...args: [...Q]) => void };
        }
      | FunctionType[],
    arg1?: (this: KernelContext, ...args: [...Q]) => void,
    arg2?: { functions?: SimpleFunctionType[] },
  ): { setSize: (ksize: number[], gsize?: number[]) => (...args: Q) => Promise<void> } {
    if (Array.isArray(arg0) && arg1 != null) {
      return this.createFuncKernel(arg0, arg1, arg2);
    }

    if (!Array.isArray(arg0)) {
      return this.createClassKernel(arg0);
    }

    throw new Error();
  }

  // private members
  private _addonInstance: IGpgpuNative;
  private _objSerializer: ObjectSerializer;
}

export { KernelContext };
// export = Gpgpu;
// export default Gpgpu;
