import { expect } from 'chai';
import { Gpgpu, KernelContext, kernelFunction, kernelEntry, DeviceType, Types } from '../dist/binding.js';

describe('Classes test', () => {
  it('is defined', () => {
    expect(Gpgpu).to.be.not.undefined;
  });

  const instance = new Gpgpu(DeviceType.default);

  it('works with classes', async () => {
    class MyKernel extends KernelContext {
      @kernelFunction(Types.number, [Types.number])
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

    const fab = instance.createKernel(MyKernel).setSize([1000]);

    await fab(arr);
    expect(arr).to.eql(new Float32Array(1000).fill(2));
  });

  it('handles copying objects', async () => {
    class MyKernel extends KernelContext {
      @kernelEntry([{ type: 'Float32Array', readWrite: 'readwrite' }])
      main(out: Float32Array) {
        const x = this.get_global_id(0);
        const y = { a: x };
        const z = this.copy(y);
        out[x] = z.a;
      }
    }
    const arr = new Float32Array(1000);
    arr.fill(1);

    const fab = instance.createKernel(MyKernel).setSize([1000]);

    await fab(arr);
    expect(arr).to.eql(new Float32Array(1000).map((_, i) => i));
  });

  it('handles returning objects', async () => {
    class MyKernel extends KernelContext {
      @kernelFunction({ x: Types.number }, [])
      testFoo(): { x: number } {
        return { x: 1 };
      }

      @kernelEntry([{ type: 'Float32Array', readWrite: 'readwrite' }])
      main(out: Float32Array) {
        const x = this.get_global_id(0);
        const z = this.testFoo();
        const t = this.testFoo();
        out[x] = z.x;
      }
    }
    const arr = new Float32Array(1000);
    arr.fill(1);

    const fab = instance.createKernel(MyKernel).setSize([1000]);

    await fab(arr);
    expect(arr).to.eql(new Float32Array(1000).map(() => 1));
  });
});
