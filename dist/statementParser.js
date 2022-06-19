'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.StatementParser = void 0;
const recast = require('recast');
const expressionParser_1 = require('./expressionParser');
class StatementParser {
  constructor(declarationTable, expressionParser) {
    this._declarationTable = declarationTable;
    this._expressionParser = expressionParser;
  }
  parseStatement(ast) {
    const parseStatement = (ast) => this.parseStatement(ast);
    const context = new expressionParser_1.ExpressionContext();
    const parseExpression = (ast) => this._expressionParser.parseExpression(ast, context);
    const declarationTable = this._declarationTable;
    let val = null;
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
            var _a, _b, _c, _d, _e, _f, _g, _h;
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
                      ((_a = arg0.loc) === null || _a === void 0 ? void 0 : _a.start.line,
                      (_b = arg0.loc) === null || _b === void 0 ? void 0 : _b.start.column)
                    })`,
                  );
                }
                if (arg1.type !== 'Literal' || typeof arg1.value !== 'number') {
                  throw new Error(
                    `Array must have number as second argument: at (${
                      ((_c = arg0.loc) === null || _c === void 0 ? void 0 : _c.start.line,
                      (_d = arg0.loc) === null || _d === void 0 ? void 0 : _d.start.column)
                    })`,
                  );
                }
                const argType = parseExpression(arg0).type;
                if (argType.name !== 'double' && argType.name !== 'object') throw new Error();
                declarationTable.declareVariable(d.id.name, { name: 'array', contentType: argType });
                return `${(0, expressionParser_1.getTypeInfoText)(argType)} ${d.id.name}[${arg1.value}];`;
              }
              const expr = parseExpression(d.init);
              if (expr.type.name === 'object' && expr.type.global) {
                const type = Object.assign(Object.assign({}, expr.type), { global: false });
                declarationTable.declareVariable(d.id.name, type);
                return `${(0, expressionParser_1.getTypeInfoText)(type)} ${d.id.name} = ${expr.val};`;
              }
              if (expr.type.name === 'object' && !expr.type.orphan) {
                if (expr.type.name === 'object' && !expr.type.orphan) {
                  throw new Error(
                    `Cannot reasign objects (did you mean to use this.copy(obj)): for '${expr.val}' at (${
                      (_f = (_e = d.loc) === null || _e === void 0 ? void 0 : _e.start.line) !== null && _f !== void 0
                        ? _f
                        : '?'
                    },${
                      (_h = (_g = d.loc) === null || _g === void 0 ? void 0 : _g.start.column) !== null && _h !== void 0
                        ? _h
                        : '?'
                    })' for '${expr.val}'`,
                  );
                }
              }
              const type = Object.assign({}, expr.type);
              if (type.name === 'object' && type.orphan) {
                type.orphan = false;
              }
              declarationTable.declareVariable(d.id.name, type);
              return `${(0, expressionParser_1.getTypeInfoText)(type)} ${d.id.name} = ${expr.val};`;
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
    return `${context.toString()}${val}`;
  }
}
exports.StatementParser = StatementParser;
