import { translateFunction, FunctionType, SimpleFunctionType, KernelContext } from './parser';
import ObjectSerializer from './objectSerializer';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu-native');

interface IGpgpuNative {
  createKernel(
    parserCode: string,
    types: string[],
    access: string[],
  ): (ksize: number[]) => (...args: unknown[]) => Promise<void>;
}

class Gpgpu {
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

  // private members
  private _addonInstance: IGpgpuNative;
  private _objSerializer: ObjectSerializer;
}

// export = Gpgpu;
export default Gpgpu;
