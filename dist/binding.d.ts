import { FunctionType, SimpleFunctionType, KernelContext, ObjectKernelArg, ObjectArrKernelArg } from './parser';
export declare const Types: {
  number: number;
  boolean: boolean;
};
export declare function kernelFunction<R, T extends unknown[]>(
  returnObj: R,
  shapeObj: [...T],
): (_target: unknown, _propertyKey: string, descriptor: TypedPropertyDescriptor<(...args_0: T) => R>) => void;
export declare function kernelEntry<T extends FunctionType[]>(
  typing: [...T],
): (
  _target: unknown,
  _propertyKey: string,
  descriptor: TypedPropertyDescriptor<
    (
      ...args_0: {
        [K in keyof T]: T[K] extends infer T_1
          ? T_1 extends T[K]
            ? T_1 extends FunctionType
              ? T_1['type'] extends 'Float32Array'
                ? Float32Array
                : T_1['type'] extends 'Float64Array'
                ? Float64Array
                : T_1 extends ObjectKernelArg
                ? T_1['shapeObj']
                : T_1 extends ObjectArrKernelArg
                ? T_1['shapeObj']
                : T_1['type']
              : T_1
            : never
          : never;
      }
    ) => void
  >,
) => void;
export declare enum DeviceType {
  default = 1,
  gpu = 2,
  cpu = 4,
}
export declare class Gpgpu {
  constructor(device?: DeviceType);
  private setSize;
  createFuncKernel<T extends unknown[]>(
    types: FunctionType[],
    func: (this: KernelContext, ...args: [...T]) => void,
    opt?: {
      functions?: SimpleFunctionType[];
    },
  ): {
    setSize: (ksize: number[], gsize?: number[]) => (...args: unknown[]) => Promise<void>;
  };
  getLastBuildInfo(): string;
  createClassKernel<T extends KernelContext, Q extends unknown[]>(program: {
    new (): T;
    prototype: {
      main: (...args: [...Q]) => void;
    };
  }): {
    setSize: (ksize: number[], gsize?: number[]) => (...args: Q) => Promise<void>;
  };
  createKernel<Q extends unknown[]>(
    types: FunctionType[],
    func: (this: KernelContext, ...args: [...Q]) => void,
    opt?: {
      functions?: SimpleFunctionType[];
    },
  ): {
    setSize: (ksize: number[], gsize?: number[]) => (...args: unknown[]) => Promise<void>;
  };
  createKernel<T extends KernelContext, Q extends unknown[]>(program: {
    new (): T;
    prototype: {
      main: (...args: [...Q]) => void;
    };
  }): {
    setSize: (ksize: number[], gsize?: number[]) => (...args: Q) => Promise<void>;
  };
  private _addonInstance;
  private _objSerializer;
}
export { KernelContext };
