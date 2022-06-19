'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.translateFunction = exports.KernelContext = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */
const esprima = require('esprima');
const statementParser_1 = require('./statementParser');
const objectSerializer_1 = require('./objectSerializer');
const expressionParser_1 = require('./expressionParser');
const declarationTable_1 = require('./declarationTable');
class KernelContext {
  constructor() {
    this.func = null;
    this.INFINITY = null;
    this.M_PI = null;
  }
  get_global_id(dim) {
    throw new Error('Function get_global_id is not callable outside of kernel');
  }
  int(x) {
    throw new Error('Function int is not callable outside of kernel');
  }
  uint(x) {
    throw new Error('Function int is not callable outside of kernel');
  }
  long(x) {
    throw new Error('Function int is not callable outside of kernel');
  }
  ulong(x) {
    throw new Error('Function int is not callable outside of kernel');
  }
  copy(o) {
    throw new Error('Function copy is not callable outside of kernel');
  }
  sqrt(n) {
    throw new Error('Function sqrt is not callable outside of kernel');
  }
  pow(x, y) {
    throw new Error('Function pow is not callable outside of kernel');
  }
  sin(x) {
    throw new Error('Function sin is not callable outside of kernel');
  }
  cos(x) {
    throw new Error('Function cos is not callable outside of kernel');
  }
  array(shape, size) {
    throw new Error('Function array is not callable outside of kernel');
  }
}
exports.KernelContext = KernelContext;
const paramMap = new Map();
const argumentHandlers = new Map();
argumentHandlers.set('Float32Array', (name) => `__global float *${name}`);
argumentHandlers.set('Float64Array', (name) => `__global double *${name}`);
argumentHandlers.set('Object', (name) => {
  var _a;
  const param = (_a = paramMap.get(name)) === null || _a === void 0 ? void 0 : _a[0];
  if (param == null) throw new Error('Unknown argument type');
  if (param.name !== 'object') throw new Error('Object argument must be an object');
  return `global ${param.objType}* ${name}`;
  // return `${getTypeInfoText(param)} ${name}`;
});
argumentHandlers.set('Object[]', (name) => {
  var _a;
  const param = (_a = paramMap.get(name)) === null || _a === void 0 ? void 0 : _a[0];
  if (param == null) throw new Error('Unknown argument type');
  return `${(0, expressionParser_1.getTypeInfoText)(param)} ${name}`;
});
function handleArgType(name, type) {
  var _a;
  return (
    (_a = argumentHandlers.get(type.type)) !== null && _a !== void 0
      ? _a
      : () => {
          throw new Error('Unhandled argument type');
        }
  )(name);
}
// const malloc = `global void* malloc(size_t size, global uchar *heap, global uint *next)
// {
//   uint index = atomic_add(next, size);
//   return heap+index;
// }`;
function prefixFunction(c) {
  if (c.startsWith('function ')) return c;
  if (c.startsWith('(function ')) return c;
  if (c.startsWith('function(')) return c;
  if (c.startsWith('(function(')) return c;
  if (c.startsWith('(')) return `(function ${c.slice(1, c.length)}`;
  else return `function ${c}`;
}
function translateFunction(func, types, shapes, functions) {
  const jscode = `(${func.toString()})`.replace('(main', '(function');
  const program = esprima.parseScript(jscode, { loc: true });
  const st = program.body[0];
  const declarationTable = new declarationTable_1.DeclarationTable();
  const objSerializer = new objectSerializer_1.default(declarationTable);
  const expressionParser = new expressionParser_1.ExpressionParser(declarationTable);
  const statementParser = new statementParser_1.StatementParser(declarationTable, expressionParser);
  const parseStatement = (ast) => statementParser.parseStatement(ast);
  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    const fucts = functions
      .map((f) => {
        var _a, _b, _c, _d;
        const fBody = prefixFunction(f.body.toString());
        const pf = esprima.parseScript(fBody, { loc: true }).body[0];
        if (pf.type === 'FunctionDeclaration') {
          const name =
            (_a = f.name) !== null && _a !== void 0 ? _a : (_b = pf.id) === null || _b === void 0 ? void 0 : _b.name;
          if (name == null) throw new Error('Declared function must have name or identifier');
          const shape =
            /*f.shape ??*/ (_d =
              (_c = f.shapeObj) === null || _c === void 0
                ? void 0
                : _c.map((obj) => objSerializer.serializeObject(obj, false)[0])) === null || _d === void 0
              ? void 0
              : _d.map((obj) => {
                  // accept objects by reference
                  if (obj && obj.name === 'object' && !obj.global) {
                    return Object.assign(Object.assign({}, obj), { reference: true });
                  }
                  return obj;
                });
          if (shape == null) throw new Error('Shape or shapeObj must be provided');
          const returnObj = f.returnObj != null ? objSerializer.serializeObject(f.returnObj, false)[0] : null;
          const ret = /*f.return ??*/ returnObj;
          if (ret == null) throw new Error('Return or returnObj must be provided');
          // this.func.name <- set type to f type
          declarationTable.addFunction({ name, returnType: ret });
          return `${(0, expressionParser_1.getTypeInfoText)(ret)} ${name}(${shape
            .map((t, i) => {
              const pi = pf.params[i];
              if (pi.type === 'Identifier') {
                // TODO: Change that
                const tp = t !== null && t !== void 0 ? t : { name: 'int' };
                // if (tp.name === 'object') {
                //   const ntp: TypeInfo = { ...tp, reference: true };
                //   declarationTable.declareVariable(pi.name, ntp);
                //   return `${getTypeInfoText(ntp)} ${pi.name}`;
                // }
                declarationTable.declareVariable(pi.name, tp);
                // declarationTable.declareVariable(pi.name, { name: 'object', global: false, objType: objSerializer.serializeObject() });
                return `${(0, expressionParser_1.getTypeInfoText)(tp)} ${pi.name}`;
              }
              throw new Error('Function params must be identifiers');
            })
            .join(', ')}) {\n${parseStatement(pf.body)}\n}`;
        }
      })
      .join('\n');
    const spTuples = st.expression.params
      .map((p, i) => [p.type === 'Identifier' ? p.name : '', types[i]])
      .filter(([, t]) => t.type === 'Object' || t.type === 'Object[]')
      .map(([p], i) => [p, shapes[i]]);
    spTuples.forEach(([p, s]) => {
      const r = objSerializer.serializeObject(s);
      paramMap.set(p, r);
    });
    const params = st.expression.params
      .map((p, idx) => {
        var _a;
        if (p.type === 'Identifier') {
          // TODO: Change that
          const param = (_a = paramMap.get(p.name)) === null || _a === void 0 ? void 0 : _a[0];
          const tp =
            param !== null && param !== void 0
              ? param
              : types[idx].type === 'Float32Array' || types[idx].type === 'Float64Array'
              ? { name: 'array', contentType: { name: 'double' } }
              : null !== null && null !== void 0
              ? null
              : { name: 'int' };
          declarationTable.declareVariable(p.name, tp);
          return handleArgType(p.name, types[idx]);
        } else {
          throw new Error(`Unsupported function argument type: ${p.type}`);
        }
      })
      .join(', ');
    const code = st.expression.body.body.map((st) => parseStatement(st)).join('\n');
    const classes = objSerializer.getClasses();
    return `${classes}\n\n${fucts}\n\n__kernel void kernelFunc(${params}) {\n${code}\n}`;
  }
  throw new Error('Bad function construction');
}
exports.translateFunction = translateFunction;
