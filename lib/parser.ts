import * as esprima from 'esprima';
import * as recast from 'recast';

import { parseExpression } from './expressionParser';

export type FunctionType = {
  type: string;
  readWrite: string;
};

export function translateFunction(func: (...args: unknown[]) => void /*, types: FunctionType[]*/): string {
  const jscode = `(${func.toString()})`;
  const program = esprima.parseScript(jscode);
  const st = program.body[0];

  const parseStatement = (ast: recast.types.ASTNode): string => {
    let val: string | null = null;
    recast.visit(ast, {
      visitBlockStatement(path) {
        val = [`{`, ...path.node.body.map((st) => parseStatement(st)), `}`].join('\n');
        return false;
      },
      visitVariableDeclaration(path) {
        if (path.node.declarations.filter((d) => d.type !== 'VariableDeclarator' || d.init == null).length > 0) {
          throw new Error(`All declarations must be initialized variable declarations`);
        }
        val = path.node.declarations
          .map((d) => {
            if (d.type === 'VariableDeclarator' && d.init != null) {
              if (d.id.type !== 'Identifier') {
                throw new Error('Declaration must be identifier');
              }
              console.log(d.init);
              return `auto ${d.id.name} = ${parseExpression(d.init)};`;
            }
          })
          .join('\n');
        return false;
      },
      visitExpressionStatement(path) {
        if (path.node.expression.type === 'AssignmentExpression') {
          val = `${parseExpression(path.node.expression.left)} ${path.node.expression.operator} ${parseExpression(
            path.node.expression.right,
          )};`;
        } else {
          throw new Error(`Unsupported expression statement: ${path.node.expression.type}`);
        }
        return false;
      },
      visitStatement(path) {
        throw new Error(`Unsupported statement: ${path.node.type}`);
      },
    });
    if (val == null) {
      throw new Error(`Failed to parse a statement (got null)`);
    }
    return val;
  };

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    // console.log(st.expression.params[0].type)
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
