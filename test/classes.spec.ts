import { expect } from 'chai';
import { Gpgpu, KernelContext, kernelFunction, kernelEntry } from '../dist/binding.js';

describe('Classes test', () => {
  const instance = new Gpgpu();

  it('is defined', () => {
    expect(Gpgpu).to.be.not.undefined;
  });

  it('works with classes', async () => {
    class MyKernel extends KernelContext {
      @kernelFunction(1, [1])
      helper(x) { return x * 2; }

      @kernelEntry([{ type: 'Float32Array', readWrite: 'readwrite' }])
      main(out) {
        const x = this.get_global_id(0);
        out[x] = this.helper(out[x]);
      }
    }
    const arr = new Float32Array(1000);
    arr.fill(1);

    const fab = instance
      .createKernel2(MyKernel).setSize([1000]);

    await fab(arr);
    expect(arr).to.eql(new Float32Array(1000).fill(2));
  })

});
