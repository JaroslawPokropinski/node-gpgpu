import * as esprima from 'esprima';

import { parseStatement } from './statementParser';

export type FunctionType = {
  type: string;
  readWrite: string;
};

export function translateFunction(func: (...args: unknown[]) => void /*, types: FunctionType[]*/): string {
  const jscode = `(${func.toString()})`;
  const program = esprima.parseScript(jscode);
  const st = program.body[0];

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    return `__kernel void kernelFunc(${st.expression.params
      .map((p) => {
        if (p.type === 'Identifier') {
          return `__global float *${p.name}`;
        } else {
          throw new Error(`Unsupported function argument type: ${p.type}`);
        }
      })
      .join(', ')})${parseStatement(st.expression.body)}`;
  }
  throw new Error('Bad function construction');
}
