import * as esprima from 'esprima';

import { parseStatement } from './statementParser';
import ObjectSerializer from './objectSerializer';

export type FunctionType = {
  type: string;
  readWrite: string;
};

const objSerializer = new ObjectSerializer();
const paramMap = new Map<string, [string, Buffer[]]>();

const argumentHandlers = new Map<string, (name: string) => string>();
argumentHandlers.set('array', (name) => `__global float *${name}`);
argumentHandlers.set('object', (name) => `__global ${(paramMap.get(name) ?? ['unknown'])[0]} *${name}`);
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
): string {
  const jscode = `(${func.toString()})`;
  const program = esprima.parseScript(jscode);
  const st = program.body[0];

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    const spTuples = st.expression.params
      .map((p, i) => [p.type === 'Identifier' ? p.name : '', types[i]] as [string, FunctionType])
      .filter(([_, t]) => t.type === 'object' || t.type === 'Object[]')
      .map(([p], i) => [p, shapes[i]] as [string, unknown]);
    spTuples.forEach(([p, s]) => {
      const r = objSerializer.serializeObject(s);
      paramMap.set(p, r);
    });
    const classes = objSerializer.getClasses();
    return `${classes}\n__kernel void kernelFunc(${st.expression.params
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
