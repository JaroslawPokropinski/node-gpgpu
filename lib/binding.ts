import { translateFunction, FunctionType } from './parser';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const addon = require('../build/Release/gpgpu-native');

interface IGpgpuNative {
  greet(strName: string): string;
  createKernel(parserCode: string, types: string[]): (ksize: number[]) => (...args: unknown[]) => void;
}

class Gpgpu {
  constructor(name: string) {
    this._addonInstance = new addon.Gpgpu(name);
  }

  greet(strName: string): string {
    return this._addonInstance.greet(strName);
  }

  createKernel(
    func: (...args: unknown[]) => void,
    types: FunctionType[],
  ): { setSize: (ksize: number[]) => (...args: unknown[]) => void } {
    return {
      setSize: this._addonInstance.createKernel(
        translateFunction(func /*, types*/),
        types.map((t) => t.readWrite),
      ),
    };
  }

  // private members
  private _addonInstance: IGpgpuNative;
}

export = Gpgpu;
