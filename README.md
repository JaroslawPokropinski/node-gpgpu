# What is node-gpgpu
node-gpgpu is Node.js library for gpu accelerated programming. It allows to write accelerated code using subset of javascript and use it as standard javascript functions.

# Installation
For now to install this package you have to clone repository and build it from scratch. Since it uses Napi in future installation will be as easy as calling `npm install ...`.

# Build
To build node-gpgpu one has to have opencl installed; after that call `npm i` and `npm run test` to verify build.

# Examples
Examples can be found in tests such as test/test_binding.js. Here is one of them:
```javascript
const arr1 = new Float32Array(1000);
const arr2 = new Float32Array(1000);
const arr3 = new Float32Array(1000);

arr1.forEach((_, i) => (arr1[i] = i));
arr2.forEach((_, i) => (arr2[i] = 1000 - i));

const kernel = instance.createKernel(
  function (a, b, c) {
    const x = this.get_global_id(0.0);
    c[x] = a[x] + b[x];
  },
  [
    { type: 'array', readWrite: 'read' },
    { type: 'array', readWrite: 'read' },
    { type: 'array', readWrite: 'write' },
  ],
);
const f1 = kernel.setSize([1000]); // Set kernel size...
const f2 = kernel.setSize([1000], [10]); // ... and optionaly group size
arr3.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000'));
```