import { Parser } from 'acorn';
import processTemplate from './template';
import { translateFunction, FunctionType } from './parser';

const addon = require('../build/Release/gpgpu-native');

interface IGpgpuNative {
    greet(strName: string): string;
    createKernel(parserCode: string, types: string[]): (...args: any[]) => void;
};


class Gpgpu {
    constructor(name: string) {
        this._addonInstance = new addon.Gpgpu(name)
    }

    greet(strName: string) {
        return this._addonInstance.greet(strName);
    }

    createKernel(func: (...args: any[]) => void, types: FunctionType[]) {
        console.log(types.map((t) => t.readWrite))
        return this._addonInstance.createKernel(translateFunction(func, types), types.map((t) => t.readWrite));
    }

    // private members
    private _addonInstance: IGpgpuNative;
}

export = Gpgpu;
