const { expect } = require('chai');
const Gpgpu = require('../dist/binding.js').default;

describe('Basic test', () => {
  const instance = new Gpgpu();

  it('is defined', () => {
    expect(Gpgpu).to.be.not.undefined;
  })

  it('can run basic kernel', async () => {
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
    // const f2 = kernel.setSize([1000], [10]);
    await f1(arr1, arr2, arr3);

    expect(arr3).to.eql(new Float32Array(1000).fill(1000));
  })

  it('can have object args', async () => {
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
    await fab({ x: 1337 }, arr);
    expect(arr).to.eql(new Float32Array(1000).fill(1337));
  })

  it('can have array args', async () => {
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
    await fab({ y: true }, { x: 1337 }, arr);

    expect(arr).to.eql(new Float32Array(1000).fill(1337));
  })

  it('can have object array args', async () => {
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

    expect(objArr).to.be.an('Array');

    await fab(objArr, arr);
    expect(arr).to.eql(new Float32Array(1000).fill(4));
  });

  it('can have function args', async () => {
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
    await fab(objArr, arr);
    expect(arr).to.eql(new Float32Array(1000).fill(8));
  })
})