import { Types } from './binding';
export declare type ShapeObjType =
  | typeof Types['number']
  | typeof Types['boolean']
  | {
      [key: string]: ShapeObjType;
    }
  | ShapeObjType[];
export declare type WriteInfo = 'write' | 'read' | 'readwrite';
export declare type Float32ArrKernelArg = {
  type: 'Float32Array';
  readWrite: WriteInfo;
};
export declare type Float64ArrKernelArg = {
  type: 'Float64Array';
  readWrite: WriteInfo;
};
export declare type ObjectKernelArg = {
  type: 'Object';
  readWrite: WriteInfo;
  shapeObj: ShapeObjType;
};
export declare type ObjectArrKernelArg = {
  type: 'Object[]';
  readWrite: WriteInfo;
  shapeObj: [ShapeObjType];
};
export declare type FunctionType = Float32ArrKernelArg | Float64ArrKernelArg | ObjectKernelArg | ObjectArrKernelArg;
export declare class KernelContext {
  func: Record<string, Function>;
  INFINITY: number;
  M_PI: number;
  get_global_id(dim: number): number;
  int(x: number): number;
  uint(x: number): number;
  long(x: number): number;
  ulong(x: number): number;
  copy<T>(o: T): T;
  sqrt(n: number): number;
  pow(x: number, y: number): number;
  sin(x: number): number;
  cos(x: number): number;
  array<T>(shape: T, size: number): T[];
}
export declare type SimpleFunctionType = {
  name?: string;
  return?: string;
  returnObj?: unknown;
  shape?: string[];
  shapeObj?: unknown[];
  body: (this: KernelContext, ...args: never[]) => void;
};
export declare function translateFunction<T extends unknown[]>(
  func: (...args: T) => void,
  types: FunctionType[],
  shapes: unknown[],
  functions: SimpleFunctionType[],
): string;
