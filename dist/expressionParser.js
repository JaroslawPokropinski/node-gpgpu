'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ExpressionParser = exports.getTypeInfoText = exports.ExpressionContext = void 0;
const recast = require('recast');
class ExpressionContext {
  constructor() {
    this.variables = [];
  }
  declareVariable(type, value) {
    const name = `___builtin_temp_${ExpressionContext.count++}`;
    this.variables.push({ name, type, value });
    return name;
  }
  toString() {
    return this.variables
      .map((v) => {
        if (!v.value) {
          return `${getTypeInfoText(v.type)} ${v.name};\n`;
        }
        return `${getTypeInfoText(v.type)} ${v.name} = ${v.value};\n`;
      })
      .join('');
  }
}
exports.ExpressionContext = ExpressionContext;
ExpressionContext.count = 0;
const deepCopy = (object, name) => {
  const parr = [];
  for (const prop in object.properties) {
    const p = object.properties[prop];
    if (p.name === 'object') {
      parr.push(`.${prop} = ${deepCopy(p, `${name}.${prop}`)}`);
    } else {
      parr.push(`.${prop} = ${name}.${prop}`);
    }
  }
  return `(${object.objType}){ ${parr.join(', ')} }`;
};
function getTypeInfoText(ti) {
  if (['int', 'uint', 'long', 'ulong', 'double'].includes(ti.name)) {
    return ti.name;
  }
  if (ti.name === 'object') {
    if (ti.global) {
      return `${ti.objType}`;
      // return `global ${ti.objType}*`;
    }
    if (ti.reference) {
      return `${ti.objType}*`;
    }
    return `${ti.objType}`;
  }
  if (ti.name === 'array') {
    return `global ${getTypeInfoText(ti.contentType)}*`;
  }
  throw new Error(`Unsupported type inference for ${ti.name}`);
}
exports.getTypeInfoText = getTypeInfoText;
class ExpressionParser {
  constructor(declarationTable) {
    this._declarationTable = declarationTable;
  }
  parseExpression(ast, context, ignoreType = false) {
    const parseExpression = (otherAst) => this.parseExpression(otherAst, context);
    const declarationTable = this._declarationTable;
    let val = null;
    let type = null;
    recast.visit(ast, {
      visitIdentifier(path) {
        val = path.node.name;
        if (!ignoreType) {
          type = declarationTable.getVarType(path.node.name);
          if (type.name === 'object' && type.global) {
            type = Object.assign(Object.assign({}, type), { global: false });
            val = `(*${val})`;
          }
          if (type.name === 'object' && type.reference) {
            type = Object.assign(Object.assign({}, type), { reference: false });
            val = `(*${val})`;
          }
        }
        return false;
      },
      visitLiteral(path) {
        var _a;
        val = ((_a = path.node.value) === null || _a === void 0 ? void 0 : _a.toString()) || 'null';
        if (typeof path.node.value === 'number') {
          type = { name: 'double' };
        }
        return false;
      },
      visitUpdateExpression({ node }) {
        const argument = parseExpression(node.argument);
        val = `${node.prefix ? node.operator : ''}${argument.val}${!node.prefix ? node.operator : ''}`;
        type = argument.type;
        return false;
      },
      visitUnaryExpression({ node }) {
        const argument = parseExpression(node.argument);
        val = `${node.operator}${argument.val}`;
        type = argument.type;
        return false;
      },
      visitBinaryExpression(path) {
        const left = parseExpression(path.node.left);
        const operator = path.node.operator === '!==' ? '!=' : path.node.operator;
        val = `(${left.val} ${operator} ${parseExpression(path.node.right).val})`;
        type = left.type;
        return false;
      },
      visitMemberExpression(path) {
        var _a, _b;
        // Many changes to be done here (refactor this later)
        if (path.node.computed) {
          const object = parseExpression(path.node.object);
          if (object.type.name !== 'array') throw new Error(`Expected array got: ${object.type.name}`);
          if (object.type.contentType.name === 'object') {
            val = `${object.val}[(size_t)(${parseExpression(path.node.property).val})]`;
          } else {
            val = `${object.val}[(size_t)(${parseExpression(path.node.property).val})]`;
          }
          type = object.type.contentType;
        } else if (path.node.object.type === 'ThisExpression') {
          // const prop = parseExpression(path.node.property);
          // const that = parseExpression(path.node.object);
          const thisType = {
            name: 'object',
            global: false,
            objType: 'void',
            properties: {
              INFINITY: { name: 'double' },
              M_PI: { name: 'double' },
              get_global_id: { name: 'function', returnType: { name: 'int' } },
              int: { name: 'function', returnType: { name: 'int' } },
              uint: { name: 'function', returnType: { name: 'uint' } },
              long: { name: 'function', returnType: { name: 'long' } },
              ulong: { name: 'function', returnType: { name: 'ulong' } },
              sqrt: { name: 'function', returnType: { name: 'double' } },
              pow: { name: 'function', returnType: { name: 'double' } },
              sin: { name: 'function', returnType: { name: 'double' } },
              cos: { name: 'function', returnType: { name: 'double' } },
              array: { name: 'gfunction' },
            },
          };
          if (path.node.property.type !== 'Identifier') {
            throw new Error('Bad member expression with this');
          }
          // handle cast to integer
          if (path.node.property.name === 'int') {
            val = `(int)`;
            type = thisType.properties[path.node.property.name];
            return false;
          }
          if (path.node.property.name === 'uint') {
            val = `(uint)`;
            type = thisType.properties[path.node.property.name];
            return false;
          }
          if (path.node.property.name === 'long') {
            val = `(long)`;
            type = thisType.properties[path.node.property.name];
            return false;
          }
          if (path.node.property.name === 'ulong') {
            val = `(ulong)`;
            type = thisType.properties[path.node.property.name];
            return false;
          }
          if (path.node.property.name === 'copy') {
            throw new Error('Unhandled copy');
          }
          // handle build in functions
          type = thisType.properties[path.node.property.name];
          // if is not built in handle defined functions
          if (type == null) {
            const property = path.node.property;
            const ft = declarationTable._functions.reduce((p, c) => {
              if (c.name === property.name) {
                return c;
              }
              return p;
            }, null);
            if (ft == null) {
              throw new Error(`Bad member expression with this.func, "${property.name}" is not defined`);
            }
            type = { name: 'function', returnType: ft.returnType };
          }
          val = path.node.property.name;
        } else if (
          path.node.object.type === 'MemberExpression' &&
          path.node.object.object.type === 'ThisExpression' &&
          path.node.object.property.type === 'Identifier' &&
          path.node.object.property.name === 'func'
        ) {
          // const that = parseExpression(path.node.object);
          const property = path.node.property;
          if (property.type !== 'Identifier') {
            throw new Error('Bad member expression with this.func');
          }
          const ft = declarationTable._functions.reduce((p, c) => {
            if (c.name === property.name) {
              return c;
            }
            return p;
          }, null);
          if (ft == null) {
            throw new Error(`Bad member expression with this.func, "${property.name}" is not defined`);
          }
          val = property.name;
          type = { name: 'function', returnType: ft.returnType };
          // val = path.node.object.property.name;
          // type = that.type.properties[path.node.object.property.name];
        } else {
          if (path.node.property.type !== 'Identifier') throw new Error('Expected Identifier in member expression');
          const left = parseExpression(path.node.object);
          let sep = '.';
          if (left.type != null && left.type.name === 'object') {
            type = left.type.properties[path.node.property.name];
            sep = left.type.global ? '->' : '.';
          } else {
            console.log(path.node.property.type, left.type);
            throw new Error(
              `Bad member expression at (${
                (_a = path.node.property.loc) === null || _a === void 0 ? void 0 : _a.start.line
              }, ${(_b = path.node.property.loc) === null || _b === void 0 ? void 0 : _b.start.column})`,
            );
          }
          val = `${left.val}${sep}${path.node.property.name}`;
        }
        return false;
      },
      visitCallExpression(path) {
        var _a, _b;
        // handle this expression copy
        const pcallee = path.node.callee;
        if (
          pcallee.type === 'MemberExpression' &&
          pcallee.object.type === 'ThisExpression' &&
          pcallee.property.type === 'Identifier' &&
          pcallee.property.name === 'copy'
        ) {
          if (path.node.arguments.length !== 1) throw new Error(`Copy requires exactly 1 argument`);
          const arg = parseExpression(path.node.arguments[0]);
          if (arg.type.name !== 'object') throw new Error(`Copy requires object argument`);
          type = Object.assign(Object.assign({}, arg.type), { orphan: true });
          val = deepCopy(arg.type, arg.val);
          return false;
        }
        // handle unexpected this.array
        if (
          pcallee.type === 'MemberExpression' &&
          pcallee.object.type === 'ThisExpression' &&
          pcallee.property.type === 'Identifier' &&
          pcallee.property.name === 'array'
        ) {
          throw new Error(
            `Unhandled array creation at (${(_a = pcallee.loc) === null || _a === void 0 ? void 0 : _a.start.line}, ${
              (_b = pcallee.loc) === null || _b === void 0 ? void 0 : _b.start.column
            })`,
          );
        }
        const callee = parseExpression(path.node.callee);
        if (callee.type == null || callee.type.name !== 'function') {
          throw new Error(`Called expression must be a function and is ${JSON.stringify(callee)}`);
          val = `${callee.val}(${path.node.arguments.map((e) => parseExpression(e).val).join(', ')})`;
          return false;
        }
        // throw new Error(`Called expression must be a function and is ${JSON.stringify(callee)}`);
        type = callee.type.returnType;
        val = `${callee.val}(${path.node.arguments
          .map((e) => {
            const pe = parseExpression(e);
            // pass objects by reference
            if (pe.type.name === 'object' && !pe.type.reference) {
              if (pe.type.rvalue) {
                // handle rvalues
                const name = context.declareVariable(pe.type, pe.val);
                return `&(${name})`;
              }
              return `&(${pe.val})`;
            }
            return pe.val;
          })
          .join(', ')})`;
        return false;
        // Else if generic function
        // const arg0 = path.node.arguments[0];
        // if (arg0.type !== 'Literal' && arg0.type !== 'ObjectExpression') {
        //   throw new Error(
        //     `Generic function must be typed using literal or object expression: at (${
        //       (arg0.loc?.start.line, arg0.loc?.start.column)
        //     })`,
        //   );
        // }
        // if (arg0.type === 'Literal') {
        //   if (typeof arg0.value !== 'number') {
        //     throw new Error(
        //       `Generic function must be typed using number literal: at (${
        //         (arg0.loc?.start.line, arg0.loc?.start.column)
        //       })`,
        //     );
        //   }
        //   type = { name: 'double' };
        // } else {
        //   type = parseExpression(arg0).type; // {name: 'object', global: false, orphan: true, objType: 'SHAPE', properties: properties}
        // }
        // val = `${callee.val}(${path.node.arguments
        //   .slice(1)
        //   .map((e) => parseExpression(e).val)
        //   .join(', ')})`;
        // return false;
      },
      visitThisExpression() {
        throw new Error('This expression should be only in member expression');
      },
      visitAssignmentExpression(path) {
        var _a, _b;
        const right = parseExpression(path.node.right);
        if (right.type.name === 'object' && !((_a = right.type.orphan) !== null && _a !== void 0 ? _a : false))
          throw new Error('Cannot reasign objects (did you mean to use this.copy(obj))');
        if (right.type.name === 'object' && ((_b = right.type.orphan) !== null && _b !== void 0 ? _b : false)) {
          right.type.orphan = false;
        }
        val = `${parseExpression(path.node.left).val} ${path.node.operator} ${right.val}`;
        type = right.type;
        return false;
      },
      visitLogicalExpression({ node }) {
        val = `${parseExpression(node.left).val} ${node.operator} ${parseExpression(node.right).val}`;
        type = { name: 'int' };
        return false;
      },
      visitObjectExpression(path) {
        const props = path.node.properties.map((prop) => {
          if (prop.type !== 'Property') throw new Error('Property must be an "Property"');
          if (prop.key.type !== 'Identifier') throw new Error('Property must have Identifier as a key"');
          return { key: prop.key.name, value: parseExpression(prop.value) };
        });
        const objName = declarationTable.getObject(props.map((prop) => [getTypeInfoText(prop.value.type), prop.key]));
        const properties = props.reduce(
          (obj, { key, value }) => Object.assign(Object.assign({}, obj), { [key]: value.type }),
          {},
        );
        val = `(${objName}){ ${props.map((p) => `.${p.key} = ${p.value.val}`).join(', ')} }`;
        // val = `new${objName}(heap, next${props.length > 0 ? ', ' : ''}${props.map((p) => p.value.val).join(', ')})`;
        type = { name: 'object', global: false, objType: `${objName}`, properties, orphan: true };
        return false;
      },
      visitExpression(path) {
        throw new Error(`Unsupported expression: ${path.node.type}`);
      },
    });
    if (type == null) {
      type = { name: 'double' };
    }
    if (val == null || type == null) {
      throw new Error(`Failed to parse a expression (got null)`);
    }
    const asType = type;
    if (asType.name === 'object' && asType.global) {
      // console.log({ val: `(${val})`, type: { ...asType, global: false } });
      return { val: `(${val})`, type: Object.assign(Object.assign({}, asType), { global: false }) };
    }
    return { val, type };
  }
}
exports.ExpressionParser = ExpressionParser;
