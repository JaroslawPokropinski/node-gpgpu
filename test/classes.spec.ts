import { expect } from 'chai';
import { Gpgpu, KernelContext, kernelFunction, kernelEntry, DeviceType } from '../dist/binding.js';

describe('Classes test', () => {
  it('is defined', () => {
    expect(Gpgpu).to.be.not.undefined;
  });

  const instance = new Gpgpu(DeviceType.default);

  it('works with classes', async () => {
    class MyKernel extends KernelContext {
      @kernelFunction(1, [1])
      helper(x: number) {
        return x * 2;
      }

      @kernelEntry([{ type: 'Float32Array', readWrite: 'readwrite' }])
      main(out: Float32Array) {
        const x = this.get_global_id(0);
        out[x] = this.helper(out[x]);
      }
    }
    const arr = new Float32Array(1000);
    arr.fill(1);

    const fab = instance.createKernel2(MyKernel).setSize([1000]);

    await fab(arr);
    expect(arr).to.eql(new Float32Array(1000).fill(2));
  });
});
