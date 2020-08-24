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
    [
      { type: 'Float32Array', readWrite: 'read' },
      { type: 'Float32Array', readWrite: 'read' },
      { type: 'Float32Array', readWrite: 'write' },
    ],
    function (a, b, c) {
      const x = this.get_global_id(0);

      c[x] = a[x] + b[x];
    },
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

  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object', readWrite: 'read', shapeObj: { x: 0 } },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (a, b) {
        const x = this.get_global_id(0);

        b[x] = a.x;
      },
    )
    .setSize([1000], [10]);
  fab({ x: 1337 }, arr);
  arr.forEach((el) => assert.equal(el, 1337, 'Elements of array should equal 1337'));
}

assert.doesNotThrow(testObjectArgsWithArr, undefined, 'testObjectArgsWithArr threw');
function testObjectArgsWithArr() {
  console.log(`Running test testObjectArgs`);

  const obj = {
    x: 0,
  };
  const arr = new Float32Array(1000);

  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object', readWrite: 'read', shapeObj: { y: true } },
        { type: 'Object', readWrite: 'read', shapeObj: obj },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (a1, a2, b) {
        const x = this.get_global_id(0);

        b[x] = a2.x;
      },
    )
    .setSize([1000], [10]);
  fab({ y: true }, { x: 1337 }, arr);
  arr.forEach((el) => assert.equal(el, 1337, 'Elements of array should equal 1337'));
}

assert.doesNotThrow(testObjectArr, undefined, 'testObjectArr threw');
function testObjectArr() {
  console.log(`Running test testObjectArr`);

  const objArr = [1, 2, 3, 4, 5].map((v) => ({ x: v }));
  const arr = new Float32Array(1000);

  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object[]', readWrite: 'read', shapeObj: { x: 0 } },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (a, b) {
        const x = this.get_global_id(0);

        b[x] = a[3].x;
      },
    )
    .setSize([1000], [10]);
  assert(Array.isArray(objArr), 'Object[] is not an array');
  fab(objArr, arr);
  arr.forEach((el) => assert.equal(el, 4, 'Elements of array should equal 4'));
}

assert.doesNotThrow(testSimpleFuncArgs, undefined, 'testSimpleFuncArgs threw');
function testSimpleFuncArgs() {
  console.log(`Running test testSimpleFuncArgs`);

  const objArr = [0, 1, 2, 3, 4].map((v) => ({ x: v }));
  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object[]', readWrite: 'read', shapeObj: { x: 0 } },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (a, out) {
        const x = this.get_global_id(0);
        out[x] = this.map(a[4].x);
      },
      {
        functions: [
          {
            // name: 'map',
            return: 'float',
            shape: ['float'],
            body: function map(x) {
              return x * 2;
            },
          },
        ],
      },
    )
    .setSize([1000], [10]);
  fab(objArr, arr);
  arr.forEach((el) => assert.equal(el, 8, 'Elements of array should equal 4'));
}

assert.doesNotThrow(testFuncArgs, undefined, 'testFuncArgs threw');
function testFuncArgs() {
  console.log(`Running test testFuncArgs`);

  const objArr = [0, 1, 2, 3, 4].map((v) => ({ x: v }));
  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object[]', readWrite: 'read', shapeObj: { x: 0 } },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (a, out) {
        const x = this.get_global_id(0);
        out[x] = this.map(a[4]);
      },
      {
        functions: [
          {
            // name: 'map',
            return: 'float',
            shapeObj: [{ x: 0 }],
            body: function map(x) {
              return x.x;
            },
          },
        ],
      },
    )
    .setSize([1000], [10]);
  fab(objArr, arr);
  arr.forEach((el) => assert.equal(el, 4, 'Elements of array should equal 4'));
}

assert.doesNotThrow(testObjDeclaration, undefined, 'testObjDeclaration threw');
function testObjDeclaration() {
  console.log(`Running test testObjDeclaration`);

  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel([{ type: 'Float32Array', readWrite: 'write' }], function (out) {
      const x = this.get_global_id(0);
      const obj = { x: x, y: 1000 - x };
      const y = obj.y;
      out[x] = obj.x + y;
    })
    .setSize([1000], [10]);
  fab(arr);
  arr.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000'));
}

console.log('Tests passed- everything looks OK!');
