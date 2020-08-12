import { translateFunction, FunctionType } from './parser';
import ObjectSerializer from './objectSerializer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu-native');

interface IGpgpuNative {
  createKernel(
    parserCode: string,
    types: string[],
    access: string[],
  ): (ksize: number[]) => (...args: unknown[]) => void;
}

interface KernelContext {
  get_global_id(dim: number): number;
}

class Gpgpu {
  constructor() {
    this._addonInstance = new addon.Gpgpu();
    this._objSerializer = new ObjectSerializer();
  }

  createKernel(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    types: FunctionType[],
    shapes: unknown[] = [],
    func: (this: KernelContext, ...args: any[]) => void,
  ): { setSize: (ksize: number[]) => (...args: unknown[]) => void } {
    return {
      setSize: (ksize) => (...args) => {
        const serializedArgs = args.map((arg, i) => {
          console.log(i, types[i]);
          if (types[i].type === 'object') {
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
        this._addonInstance.createKernel(
          translateFunction(func, types, shapes),
          types.map((t) => t.type),
          types.map((t) => t.readWrite),
        )(ksize)(...serializedArgs);
      },
    };
  }

  // private members
  private _addonInstance: IGpgpuNative;
  private _objSerializer: ObjectSerializer;
}

// export = Gpgpu;
export default Gpgpu;
