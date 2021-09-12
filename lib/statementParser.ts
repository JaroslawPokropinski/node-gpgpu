import * as recast from 'recast';
import { ExpressionParser, getTypeInfoText } from './expressionParser';
import { DeclarationTable } from './declarationTable';

export class StatementParser {
  _declarationTable: DeclarationTable;
  _expressionParser: ExpressionParser;

  constructor(declarationTable: DeclarationTable, expressionParser: ExpressionParser) {
    this._declarationTable = declarationTable;
    this._expressionParser = expressionParser;
  }

  parseStatement(ast: recast.types.ASTNode): string {
    const parseStatement = (ast: recast.types.ASTNode) => this.parseStatement(ast);
    const parseExpression = (ast: recast.types.ASTNode) => this._expressionParser.parseExpression(ast);
    const declarationTable = this._declarationTable;

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
        // return `${
        //   expr.type.name !== 'object'
        //     ? expr.type.name
        //     : `global ${expr.type.objType}${expr.type.global ? '' : '*'}`
        val = path.node.declarations
          .map((d) => {
            if (d.type === 'VariableDeclarator' && d.init != null) {
              if (d.id.type !== 'Identifier') {
                throw new Error('Declaration must be identifier');
              }

              // handle array creation
              if (
                d.init.type === 'CallExpression' &&
                d.init.callee.type === 'MemberExpression' &&
                d.init.callee.object.type === 'ThisExpression' &&
                d.init.callee.property.type === 'Identifier' &&
                d.init.callee.property.name === 'array'
              ) {
                if (d.init.arguments.length !== 2) throw new Error(`Array requires exactly 2 arguments`);
                const arg0 = d.init.arguments[0];
                const arg1 = d.init.arguments[1];
                if (arg0.type !== 'Literal' && arg0.type !== 'ObjectExpression') {
                  throw new Error(
                    `Array must be typed using literal or object expression: at (${
                      (arg0.loc?.start.line, arg0.loc?.start.column)
                    })`,
                  );
                }

                if (arg1.type !== 'Literal' || typeof arg1.value !== 'number') {
                  throw new Error(
                    `Array must have number as second argument: at (${(arg0.loc?.start.line, arg0.loc?.start.column)})`,
                  );
                }
                const argType = parseExpression(arg0).type;
                if (argType.name !== 'double' && argType.name !== 'object') throw new Error();

                declarationTable.declareVariable(d.id.name, { name: 'array', contentType: argType });
                return `${getTypeInfoText(argType)} ${d.id.name}[${arg1.value}];`;
              }
              const expr = parseExpression(d.init);
              if (expr.type.name === 'object' && expr.type.global) {
                const type = { ...expr.type, global: false };
                declarationTable.declareVariable(d.id.name, type);
                return `${getTypeInfoText(type)} ${d.id.name} = ${expr.val};`;
              }

              if (expr.type.name === 'object' && !expr.type.orphan) {
                if (expr.type.name === 'object' && !expr.type.orphan) {
                  throw new Error(
                    `Cannot reasign objects (did you mean to use this.copy(obj)): for '${expr.val}' at (${
                      d.loc?.start.line ?? '?'
                    },${d.loc?.start.column ?? '?'})' for '${expr.val}'`,
                  );
                }
              }

              const type = { ...expr.type };
              if (type.name === 'object' && type.orphan) {
                type.orphan = false;
              }

              declarationTable.declareVariable(d.id.name, type);
              return `${getTypeInfoText(type)} ${d.id.name} = ${expr.val};`;
            }
          })
          .join('\n');
        return false;
      },
      visitIfStatement(path) {
        val = `if (${parseExpression(path.node.test).val}) ${parseStatement(path.node.consequent)} ${
          path.node.alternate ? `else ${parseStatement(path.node.alternate)}` : ''
        }`;
        return false;
      },
      visitForStatement(path) {
        val = `for(${path.node.init ? parseStatement(path.node.init) : ';'} ${
          path.node.test ? parseExpression(path.node.test).val : ''
        }; ${path.node.update ? parseExpression(path.node.update).val : ''}) ${parseStatement(path.node.body)}`;
        return false;
      },
      visitExpressionStatement(path) {
        if (path.node.expression.type === 'AssignmentExpression') {
          val = `${parseExpression(path.node.expression.left).val} ${path.node.expression.operator} ${
            parseExpression(path.node.expression.right).val
          };`;
        } else {
          throw new Error(`Unsupported expression statement: ${path.node.expression.type}`);
        }
        return false;
      },
      visitReturnStatement(path) {
        val = `return ${path.node.argument ? parseExpression(path.node.argument).val : ''};`;
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
}
