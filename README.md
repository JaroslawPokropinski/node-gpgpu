# What is node-gpgpu

node-gpgpu is Node.js library for gpu accelerated programming. It allows to write accelerated code using subset of javascript and use it as standard javascript functions.

# Dependencies

To install and use node-gpgpu you will need cmake, opencl library and opencl runtime installed.

# Installation

`npm i node-gpgpu`

# Build

To build node-gpgpu one has to have opencl installed; after that call `npm i` and `npm run test` to verify build.

# Examples
One of examples is numerical ingetration on the gpu. More examples can be found in repository [node-gpgpu-examples](https://github.com/JaroslawPokropinski/node-gpgpu-examples) that contains code and links to google collab where you can execute it. You can also find some examples in tests such as test/classes.spec.ts.

```javascript
import { Gpgpu, KernelContext, Types, kernelEntry, kernelFunction } from 'node-gpgpu';
async function main() {
  const n = 2000;
  const iter = 216;
  const gpgpu = new Gpgpu();

  class PiIntegralKernel extends KernelContext {
    @kernelFunction(Types.number, [Types.number])
    f(x: number) {
      return 2 * this.sqrt(1 - x * x);
    }

    @kernelEntry([
      { type: 'Float32Array', readWrite: 'write' },
      { type: 'Object', readWrite: 'read', shapeObj: { n: Types.number, iter: Types.number } },
    ])
    main(c: Float32Array, opt: { n: number, iter: number }) {
      const id = this.get_global_id(0);

      c[id] = 0.0;
      for (let i = id * opt.iter; i < (id + 1) * opt.iter; i += 1) {
        const dx = 2 / (opt.n * opt.iter);
        const x1 = dx * i - 1;
        const x2 = dx * (i + 1) - 1;

        c[id] += (this.f(x2) + this.f(x1)) * 0.5 * dx;
      }
    }
  }

  const k = gpgpu.createKernel(PiIntegralKernel).setSize([2000], [10]);
  const c = new Float32Array(n);

  await k(c, { n, iter });
  const res = c.reduce((prev, curr) => prev + curr);
  console.log(`Result: ${res}`);
}
main();
```
# Roadmap
- [ ] Array attributes: length, pop, push, maxLength, etc.
- [ ] Math object: Math.random(), Math.floor(), etc.
- [ ] Partial results: allow for getting multiple results from a kernel to limit memory being moved to the kernel.
