import {
  translateFunction,
  FunctionType,
  SimpleFunctionType,
  KernelContext,
  Float32ArrKernelArg,
  ShapeObjType,
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
    const v = (descriptor.value as unknown) as { shapeObj: [...T]; returnObj: R };
    v.shapeObj = shapeObj;
    v.returnObj = returnObj;
  };
}

const mapWithType = (x: FunctionType): Float32Array | Object => {
  if (x.type === 'Float32Array') return new Float32Array();
  else return {};
};

export function kernelEntry<T extends FunctionType[]>(typing: [...T]) {
  type Types = {
    [K in keyof T]: T[K] extends FunctionType
      ? T[K]['type'] extends 'Float32Array'
        ? Float32Array
        : T[K]['type'] extends 'Float64Array'
        ? Float64Array
        : T[K] extends ObjectKernelArg
        ? T[K]['shapeObj']
        : T[K] extends ObjectArrKernelArg
        ? T[K]['shapeObj']
        : T[K]['type']
      : T[K];
  };

  // type Types = { [Key in keyof typeof typing]: Key extends Float32ArrKernelArg ? Float32Array : undefined };
  // return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor): void {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: [...Types]) => void>,
  ): void {
    const v = (descriptor.value as unknown) as { typing: FunctionType[] };
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

  createKernel(
    types: FunctionType[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: (this: KernelContext, ...args: any[]) => void,
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
      setSize: (ksize, gsize) => (...args) => {
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
      },
    };
  }

  createKernel2(
    program: any,
  ): { setSize: (ksize: number[], gsize?: number[]) => (...args: unknown[]) => Promise<void> } {
    new program(); // This initialises program.prototype.main.typing etc.
    const func = program.prototype.main;
    const types = program.prototype.main.typing;
    const functions = Object.getOwnPropertyNames(program.prototype)
      .filter((item) => typeof program.prototype[item] === 'function')
      .filter((k) => k !== 'constructor' && k !== 'main')
      .map((f) => program.prototype[f])
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
        types.flatMap((ft: any) => (ft.shapeObj ? [ft.shapeObj] : [])),
        functions,
      ),
      types.map((t: any) => t.type),
      types.map((t: any) => t.readWrite),
    );
    return {
      setSize: (ksize, gsize) => (...args) => {
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
      },
    };
  }

  // private members
  private _addonInstance: IGpgpuNative;
  private _objSerializer: ObjectSerializer;
}

export { KernelContext };
// export = Gpgpu;
// export default Gpgpu;
