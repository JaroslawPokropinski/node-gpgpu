/* eslint-disable @typescript-eslint/no-var-requires */
const Gpgpu = require('../dist/binding.js').default;
const assert = require('assert');

assert(Gpgpu, 'The expected module is undefined');

const instance = new Gpgpu('mr-yeoman');

function testBasic() {
  console.log(`Running test testBasic`);

  assert(instance.greet, 'The expected method is not defined');
  assert.strictEqual(instance.greet('kermit'), 'mr-yeoman', 'Unexpected value returned');
}

function testKernel() {
  console.log(`Running test testKernel`);
  console.log(instance);
  assert(instance.greet, 'The expected method is not defined');
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

assert.doesNotThrow(testBasic, undefined, 'testBasic threw an expection');
assert.doesNotThrow(testKernel, undefined, "testKernel  didn't throw");

console.log('Tests passed- everything looks OK!');
