/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */
import * as esprima from 'esprima';

import { StatementParser } from './statementParser';
import ObjectSerializer from './objectSerializer';
import { ExpressionParser, TypeInfo, getTypeInfoText } from './expressionParser';
import { DeclarationTable } from './declarationTable';
import { Types } from './binding';

export type ShapeObjType =
  | typeof Types['number']
  | typeof Types['boolean']
  | { [key: string]: ShapeObjType }
  | ShapeObjType[];

export type WriteInfo = 'write' | 'read' | 'readwrite';
export type Float32ArrKernelArg = { type: 'Float32Array'; readWrite: WriteInfo };
export type Float64ArrKernelArg = { type: 'Float64Array'; readWrite: WriteInfo };
export type ObjectKernelArg = { type: 'Object'; readWrite: WriteInfo; shapeObj: ShapeObjType };
export type ObjectArrKernelArg = { type: 'Object[]'; readWrite: WriteInfo; shapeObj: [ShapeObjType] };

export type FunctionType = Float32ArrKernelArg | Float64ArrKernelArg | ObjectKernelArg | ObjectArrKernelArg;

export class KernelContext {
  func: Record<string, Function> = null as unknown as Record<string, Function>;
  INFINITY: number = null as unknown as number;
  M_PI: number = null as unknown as number;

  get_global_id(dim: number): number {
    throw new Error('Function get_global_id is not callable outside of kernel');
  }
  int(x: number): number {
    throw new Error('Function int is not callable outside of kernel');
  }
  uint(x: number): number {
    throw new Error('Function int is not callable outside of kernel');
  }
  long(x: number): number {
    throw new Error('Function int is not callable outside of kernel');
  }
  ulong(x: number): number {
    throw new Error('Function int is not callable outside of kernel');
  }
  copy<T>(o: T): T {
    throw new Error('Function copy is not callable outside of kernel');
  }
  sqrt(n: number): number {
    throw new Error('Function sqrt is not callable outside of kernel');
  }
  pow(x: number, y: number): number {
    throw new Error('Function pow is not callable outside of kernel');
  }
  sin(x: number): number {
    throw new Error('Function sin is not callable outside of kernel');
  }
  cos(x: number): number {
    throw new Error('Function cos is not callable outside of kernel');
  }

  array<T>(shape: T, size: number): T[] {
    throw new Error('Function array is not callable outside of kernel');
  }
}

export type SimpleFunctionType = {
  name?: string;
  return?: string;
  returnObj?: unknown;
  shape?: string[];
  shapeObj?: unknown[];
  body: (this: KernelContext, ...args: never[]) => void;
};

const paramMap = new Map<string, [TypeInfo | null, Buffer[]]>();

const argumentHandlers = new Map<string, (name: string) => string>();
argumentHandlers.set('Float32Array', (name) => `__global float *${name}`);
argumentHandlers.set('Float64Array', (name) => `__global double *${name}`);
argumentHandlers.set('Object', (name) => {
  const param = paramMap.get(name)?.[0];
  if (param == null) throw new Error('Unknown argument type');
  if (param.name !== 'object') throw new Error('Object argument must be an object');

  return `global ${param.objType}* ${name}`;
  // return `${getTypeInfoText(param)} ${name}`;
});
argumentHandlers.set('Object[]', (name) => {
  const param = paramMap.get(name)?.[0];
  if (param == null) throw new Error('Unknown argument type');

  return `${getTypeInfoText(param)} ${name}`;
});

function handleArgType(name: string, type: FunctionType): string {
  return (
    argumentHandlers.get(type.type) ??
    (() => {
      throw new Error('Unhandled argument type');
    })
  )(name);
}

// const malloc = `global void* malloc(size_t size, global uchar *heap, global uint *next)
// {
//   uint index = atomic_add(next, size);
//   return heap+index;
// }`;

function prefixFunction(c: string): string {
  if (c.startsWith('function ')) return c;
  if (c.startsWith('(function ')) return c;
  if (c.startsWith('function(')) return c;
  if (c.startsWith('(function(')) return c;
  if (c.startsWith('(')) return `(function ${c.slice(1, c.length)}`;
  else return `function ${c}`;
}

export function translateFunction<T extends unknown[]>(
  func: (...args: T) => void,
  types: FunctionType[],
  shapes: unknown[],
  functions: SimpleFunctionType[],
): string {
  const jscode = `(${func.toString()})`.replace('(main', '(function');
  const program = esprima.parseScript(jscode, { loc: true });
  const st = program.body[0];

  const declarationTable = new DeclarationTable();
  const objSerializer = new ObjectSerializer(declarationTable);
  const expressionParser = new ExpressionParser(declarationTable);
  const statementParser = new StatementParser(declarationTable, expressionParser);
  const parseStatement = (ast: Parameters<StatementParser['parseStatement']>[0]) => statementParser.parseStatement(ast);

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    const fucts = functions
      .map((f) => {
        const fBody = prefixFunction(f.body.toString());
        const pf = esprima.parseScript(fBody, { loc: true }).body[0];
        if (pf.type === 'FunctionDeclaration') {
          const name = f.name ?? pf.id?.name;
          if (name == null) throw new Error('Declared function must have name or identifier');

          const shape = /*f.shape ??*/ f.shapeObj
            ?.map((obj) => objSerializer.serializeObject(obj, false)[0])
            ?.map((obj) => {
              // accept objects by reference
              if (obj && obj.name === 'object' && !obj.global) {
                return { ...obj, reference: true };
              }
              return obj;
            });

          if (shape == null) throw new Error('Shape or shapeObj must be provided');

          const returnObj = f.returnObj != null ? objSerializer.serializeObject(f.returnObj, false)[0] : null;
          const ret = /*f.return ??*/ returnObj;
          if (ret == null) throw new Error('Return or returnObj must be provided');

          // this.func.name <- set type to f type
          declarationTable.addFunction({ name, returnType: ret });

          return `${getTypeInfoText(ret)} ${name}(${shape
            .map((t, i) => {
              const pi = pf.params[i];
              if (pi.type === 'Identifier') {
                // TODO: Change that
                const tp = t ?? { name: 'int' };

                // if (tp.name === 'object') {
                //   const ntp: TypeInfo = { ...tp, reference: true };
                //   declarationTable.declareVariable(pi.name, ntp);

                //   return `${getTypeInfoText(ntp)} ${pi.name}`;
                // }

                declarationTable.declareVariable(pi.name, tp);
                // declarationTable.declareVariable(pi.name, { name: 'object', global: false, objType: objSerializer.serializeObject() });
                return `${getTypeInfoText(tp)} ${pi.name}`;
              }
              throw new Error('Function params must be identifiers');
            })
            .join(', ')}) {\n${parseStatement(pf.body)}\n}`;
        }
      })
      .join('\n');
    const spTuples = st.expression.params
      .map((p, i) => [p.type === 'Identifier' ? p.name : '', types[i]] as [string, FunctionType])
      .filter(([, t]) => t.type === 'Object' || t.type === 'Object[]')
      .map(([p], i) => [p, shapes[i]] as [string, unknown]);
    spTuples.forEach(([p, s]) => {
      const r = objSerializer.serializeObject(s);
      paramMap.set(p, r);
    });
    const params = st.expression.params
      .map((p, idx) => {
        if (p.type === 'Identifier') {
          // TODO: Change that
          const param = paramMap.get(p.name)?.[0];
          const tp: TypeInfo =
            param ??
            (types[idx].type === 'Float32Array' || types[idx].type === 'Float64Array'
              ? { name: 'array', contentType: { name: 'double' } }
              : null ?? { name: 'int' });
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
