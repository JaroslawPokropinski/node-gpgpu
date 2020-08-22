import * as esprima from 'esprima';

import { parseStatement } from './statementParser';
import ObjectSerializer from './objectSerializer';

export type FunctionType = {
  type: string;
  readWrite: string;
  shape?: unknown;
  shapeObj?: unknown;
};

type SimpleFunctionType = {
  name?: string;
  return: string;
  shape?: string[];
  shapeObj?: unknown[];
  body: (...args: any[]) => void;
};

const objSerializer = new ObjectSerializer();
const paramMap = new Map<string, [string, Buffer[]]>();

const argumentHandlers = new Map<string, (name: string) => string>();
argumentHandlers.set('Float32Array', (name) => `__global float *${name}`);
argumentHandlers.set('Float64Array', (name) => `__global double *${name}`);
argumentHandlers.set('Object', (name) => `${(paramMap.get(name) ?? ['unknown'])[0]} ${name}`);
argumentHandlers.set('Object[]', (name) => `__global ${(paramMap.get(name) ?? ['unknown'])[0]} *${name}`);

function handleArgType(name: string, type: FunctionType): string {
  return (
    argumentHandlers.get(type.type) ??
    (() => {
      throw new Error('Unhandled argument type');
    })
  )(name);
}

export function translateFunction(
  func: (...args: unknown[]) => void,
  types: FunctionType[],
  shapes: unknown[],
  functions: SimpleFunctionType[],
): string {
  const jscode = `(${func.toString()})`;
  const program = esprima.parseScript(jscode);
  const st = program.body[0];

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    const fucts = functions
      .map((f) => {
        const pf = esprima.parseScript(f.body.toString()).body[0];
        if (pf.type === 'FunctionDeclaration') {
          const name = f.name ?? pf.id?.name;
          if (name == null) throw new Error('Declared function must have name or identifier');

          const shape = f.shape ?? f.shapeObj?.map((obj) => objSerializer.serializeObject(obj)[0]);
          if (shape == null) throw new Error('Shape or shapeObj must be provided');

          return `${f.return} ${name}(${shape
            .map((t, i) => {
              const pi = pf.params[i];
              if (pi.type === 'Identifier') {
                return `${t} ${pi.name}`;
              }
              throw new Error('Function params must be identifiers');
            })
            .join(', ')}) {\n${parseStatement(pf.body)}\n}`;
        }
      })
      .join('\n');
    const spTuples = st.expression.params
      .map((p, i) => [p.type === 'Identifier' ? p.name : '', types[i]] as [string, FunctionType])
      .filter(([_, t]) => t.type === 'Object' || t.type === 'Object[]')
      .map(([p], i) => [p, shapes[i]] as [string, unknown]);
    spTuples.forEach(([p, s]) => {
      const r = objSerializer.serializeObject(s);
      paramMap.set(p, r);
    });
    const classes = objSerializer.getClasses();
    return `${classes}\n\n${fucts}\n\n__kernel void kernelFunc(${st.expression.params
      .map((p, idx) => {
        if (p.type === 'Identifier') {
          return handleArgType(p.name, types[idx]);
        } else {
          throw new Error(`Unsupported function argument type: ${p.type}`);
        }
      })
      .join(', ')}) {\n${st.expression.body.body.map((st) => parseStatement(st)).join('\n')}\n}`;
  }
  throw new Error('Bad function construction');
}
