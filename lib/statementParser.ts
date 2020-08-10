import * as recast from 'recast';
import { parseExpression } from './expressionParser';

export function parseStatement(ast: recast.types.ASTNode): string {
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
    visitForStatement(path) {
      val = `for(${path.node.init ? parseExpression(path.node.init) : ''}; ${
        path.node.test ? parseExpression(path.node.test) : ''
      }; ${path.node.update ? parseExpression(path.node.update) : ''}) ${parseStatement(path.node.body)}`;
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
}
