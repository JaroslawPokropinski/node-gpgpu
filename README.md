# What is node-gpgpu

node-gpgpu is Node.js library for gpu accelerated programming. It allows to write accelerated code using subset of javascript and use it as standard javascript functions.

# Installation

For now to install this package you have to clone repository and build it from scratch. Since it uses Napi in future installation will be as easy as calling `npm install ...`.

# Build

To build node-gpgpu one has to have opencl installed; after that call `npm i` and `npm run test` to verify build.

# Examples

Examples can be found in tests such as test/classes.spec.ts. Here is one of them:

```javascript
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

const f = instance
  .createKernel2(MyKernel) // create kernel from a class
  .setSize([1000]); // and set kernel size

await f(arr);

expect(arr).to.eql(new Float32Array(1000).fill(2));

const f1 = kernel.setSize([1000]); // Set kernel size...
const f2 = kernel.setSize([1000], [10]); // ... and optionaly group size
arr3.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000'));
```
