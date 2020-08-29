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
        { type: 'Object[]', readWrite: 'read', shapeObj: [{ x: 0 }] },
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
        { type: 'Object[]', readWrite: 'read', shapeObj: [{ x: 0 }] },
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
            returnObj: 1,
            shapeObj: [1],
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
        { type: 'Object[]', readWrite: 'read', shapeObj: [{ x: 0 }] },
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
            returnObj: 0,
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

assert.doesNotThrow(testMultipleObjDeclaration, undefined, 'testMultipleObjDeclaration threw');
function testMultipleObjDeclaration() {
  console.log(`Running test testMultipleObjDeclaration`);

  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel([{ type: 'Float32Array', readWrite: 'write' }], function (out) {
      const x = this.get_global_id(0);
      const obj = { x: x, y: 1000 - x };
      const obj2 = { x: obj.x * 2, y: obj.y * 2 };
      const y = obj2.y;
      out[x] = obj2.x + y;
    })
    .setSize([1000], [10]);
  fab(arr);
  arr.forEach((el) => assert.equal(el, 2000, 'Elements of array should equal 2000'));
}

assert.doesNotThrow(testNestedObjDeclaration, undefined, 'testNestedObjDeclaration threw');
function testNestedObjDeclaration() {
  console.log(`Running test testNestedObjDeclaration`);

  const arr = new Float32Array(1000);
  arr.fill(0);

  const fab = instance
    .createKernel([{ type: 'Float32Array', readWrite: 'write' }], function (out) {
      const x = this.get_global_id(0);
      const obj = { a: { x: 0 + x }, b: { y: 1000 - x } };
      out[x] = obj.a.x + obj.b.y;
    })
    .setSize([1000], [10]);
  fab(arr);
  arr.forEach((el) => assert.equal(el, 1000, 'Elements of array should equal 1000'));
}

assert.doesNotThrow(testInferParameterProperties, undefined, 'testInferParameterProperties threw');
function testInferParameterProperties() {
  console.log(`Running test testInferParameterProperties`);

  const N = 10;
  const arr = new Float32Array(N);
  arr.fill(0);

  const fab = instance
    .createKernel([{ type: 'Float32Array', readWrite: 'write' }], function (out) {
      const x = this.get_global_id(0);
      const obj = { x: x, y: 1000 - x };
      const obj2 = { x: obj.x * 2, y: { a: obj.y * 2 } };
      const y = obj2.y;
      out[x] = obj2.x + y.a;
    })
    .setSize([N], [1]);
  fab(arr);
  arr.forEach((el) => assert.equal(el, 2000, 'Elements of array should equal 2000'));
}

assert.doesNotThrow(testInferArgParameterProperties, undefined, 'testInferArgParameterProperties threw');
function testInferArgParameterProperties() {
  console.log(`Running test testInferArgParameterProperties`);

  const N = 10;
  const arr = new Float32Array(N);
  arr.fill(0);

  const fab = instance
    .createKernel(
      [
        { type: 'Object', readWrite: 'read', shapeObj: { x: { y: 1 } } },
        { type: 'Float32Array', readWrite: 'write' },
      ],
      function (obj, out) {
        const x = this.get_global_id(0);
        const a = obj.x;
        out[x] = a.y;
      },
    )
    .setSize([N], [1]);
  fab({ x: { y: 22 } }, arr);
  arr.forEach((el) => assert.equal(el, 22, 'Elements of array should equal 22'));
}

console.log('Tests passed- everything looks OK!');
