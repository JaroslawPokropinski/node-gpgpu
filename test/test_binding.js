/* eslint-disable @typescript-eslint/no-var-requires */
const Gpgpu = require('../dist/binding.js').default;
const assert = require('assert');

assert(Gpgpu, 'The expected module is undefined');

const instance = new Gpgpu();

assert.doesNotThrow(testKernel, undefined, 'testKernel threw');
function testKernel() {
  console.log(`Running test testKernel`);
  console.log(instance);
  assert(instance.createKernel, 'The expected method is not defined');

  const arr1 = new Float32Array(1000);
  const arr2 = new Float32Array(1000);
  const arr3 = new Float32Array(1000);

  arr1.forEach((_, i) => (arr1[i] = i));
  arr2.forEach((_, i) => (arr2[i] = 1000 - i));

  const kernel = instance.createKernel(
    function (a, b, c) {
      const x = this.get_global_id(0);

      c[x] = a[x] + b[x];
    },
    [
      { type: 'array', readWrite: 'read' },
      { type: 'array', readWrite: 'read' },
      { type: 'array', readWrite: 'write' },
    ],
  );
  const f1 = kernel.setSize([1000]);
  const f2 = kernel.setSize([1000], [10]);
  f1(arr1, arr2, arr3);
  arr3.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000'));
  arr3.forEach((_, i) => (arr3[i] = 0));
  f2(arr1, arr2, arr3);
  arr3.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000 with work group set'));
}

assert.doesNotThrow(testObjectArgs, undefined, 'testObjectArgs threw');
function testObjectArgs() {
  console.log(`Running test testObjectArgs`);

  const obj = {
    x: 1337,
  };
  const arr = new Float32Array(1000);

  arr.fill(0);

  const fab = instance
    .createKernel(
      function (a, b) {
        const x = this.get_global_id(0);

        b[x] = a.x;
      },
      [
        { type: 'object', readWrite: 'read' },
        { type: 'array', readWrite: 'write' },
      ],
      [obj],
    )
    .setSize([1000], [10]);
  fab(obj, arr);
  arr.forEach((el) => assert.equal(el, 1337, 'Elements of array should equal 1337'));
}

assert.doesNotThrow(testObjectArgsWithArr, undefined, 'testObjectArgsWithArr threw');
function testObjectArgsWithArr() {
  console.log(`Running test testObjectArgs`);

  const obj = {
    x: 1337,
  };
  const arr = new Float32Array(1000);

  arr.fill(0);

  const fab = instance
    .createKernel(
      function (a, b) {
        const x = this.get_global_id(0);

        b[x] = a.x;
      },
      [
        { type: 'object', readWrite: 'read' },
        { type: 'array', readWrite: 'write' },
      ],
      [obj],
    )
    .setSize([1000], [10]);
  fab(obj, arr);
  arr.forEach((el) => assert.equal(el, 1337, 'Elements of array should equal 1337'));
}

assert.doesNotThrow(testObjectArr, undefined, 'testObjectArr threw');
function testObjectArr() {
  console.log(`Running test testObjectArr`);

  const shape = { x: 0 };
  const objArr = [1, 2, 3, 4, 5].map((v) => ({ x: v }));
  const arr = new Float32Array(1000);

  arr.fill(0);

  const fab = instance
    .createKernel(
      function (a, b) {
        const x = this.get_global_id(0);

        b[x] = a[3].x;
      },
      [
        { type: 'Object[]', readWrite: 'read' },
        { type: 'array', readWrite: 'write' },
      ],
      [shape],
    )
    .setSize([1000], [10]);
  assert(Array.isArray(objArr), 'Object[] is not an array');
  fab(objArr, arr);
  arr.forEach((el) => assert.equal(el, 3, 'Elements of array should equal 4'));
}

console.log('Tests passed- everything looks OK!');
