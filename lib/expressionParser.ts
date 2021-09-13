import * as recast from 'recast';
import { DeclarationTable } from './declarationTable';
import { SimpleFunctionType } from './parser';

type IntInfo = { name: 'int' };
type DoubleInfo = { name: 'double' };
type FunctionInfo = { name: 'function'; returnType: TypeInfo; useHeap: boolean };
type GenFunctionInfo = { name: 'gfunction' };
type ArrayInfo = { name: 'array'; contentType: TypeInfo };
type ObjectInfo = {
  name: 'object';
  global: boolean;
  objType: string;
  orphan: boolean;
  properties: Record<string, TypeInfo>;
};

const deepCopy = (object: ObjectInfo, name: string): string => {
  const parr: string[] = [];
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

export type TypeInfo = IntInfo | DoubleInfo | FunctionInfo | GenFunctionInfo | ArrayInfo | ObjectInfo;
export function getTypeInfoText(ti: TypeInfo): string {
  if (ti.name === 'int' || ti.name === 'double') {
    return ti.name;
  }
  if (ti.name === 'object') {
    if (ti.global) {
      return `${ti.objType}`;
      // return `global ${ti.objType}*`;
    }

    return `${ti.objType}`;
  }

  if (ti.name === 'array') {
    return `global ${getTypeInfoText(ti.contentType)}*`;
  }

  throw new Error(`Unsupported type inference for ${ti.name}`);
}

export class ExpressionParser {
  _declarationTable: DeclarationTable;
  constructor(declarationTable: DeclarationTable) {
    this._declarationTable = declarationTable;
  }

  parseExpression(ast: recast.types.ASTNode, ignoreType = false): { val: string; type: TypeInfo } {
    const parseExpression = (ast: recast.types.ASTNode) => this.parseExpression(ast);
    const declarationTable = this._declarationTable;
    let val: string | null = null;
    let type: TypeInfo | null = null;
    recast.visit(ast, {
      visitIdentifier(path) {
        val = path.node.name;
        if (!ignoreType) {
          type = declarationTable.getVarType(path.node.name);
          if (type.name === 'object' && type.global) {
            type = { ...type, global: false };
            val = `(*${val})`;
          }
        }
        return false;
      },
      visitLiteral(path) {
        val = path.node.value?.toString() || 'null';
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
          const thisType: TypeInfo = {
            name: 'object',
            global: false,
            objType: 'void',
            orphan: false,
            properties: {
              INFINITY: { name: 'double' },
              M_PI: { name: 'double' },
              get_global_id: { name: 'function', returnType: { name: 'int' }, useHeap: false },
              int: { name: 'function', returnType: { name: 'int' }, useHeap: false },
              sqrt: { name: 'function', returnType: { name: 'double' }, useHeap: false },
              pow: { name: 'function', returnType: { name: 'double' }, useHeap: false },
              sin: { name: 'function', returnType: { name: 'double' }, useHeap: false },
              cos: { name: 'function', returnType: { name: 'double' }, useHeap: false },
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

          if (path.node.property.name === 'copy') {
            throw new Error('Unhandled copy');
          }
          // handle build in functions
          type = thisType.properties[path.node.property.name];

          // if is not built in handle defined functions
          if (type == null) {
            const property = path.node.property;
            const ft = declarationTable._functions.reduce<null | typeof declarationTable._functions[0]>((p, c) => {
              if (c.name === property.name) {
                return c;
              }
              return p;
            }, null);

            if (ft == null) {
              throw new Error(`Bad member expression with this.func, "${property.name}" is not defined`);
            }
            type = { name: 'function', returnType: ft.returnType, useHeap: true };
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
          const ft = declarationTable._functions.reduce<null | typeof declarationTable._functions[0]>((p, c) => {
            if (c.name === property.name) {
              return c;
            }
            return p;
          }, null);

          if (ft == null) {
            throw new Error(`Bad member expression with this.func, "${property.name}" is not defined`);
          }
          val = property.name;
          type = { name: 'function', returnType: ft.returnType, useHeap: true };
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
              `Bad member expression at (${path.node.property.loc?.start.line}, ${path.node.property.loc?.start.column})`,
            );
          }
          val = `${left.val}${sep}${path.node.property.name}`;
        }

        return false;
      },
      visitCallExpression(path) {
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

          type = { ...arg.type, orphan: true };
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
          throw new Error(`Unhandled array creation at (${pcallee.loc?.start.line}, ${pcallee.loc?.start.column})`);
        }

        const callee = parseExpression(path.node.callee);
        const heapParams = `heap, next${path.node.arguments.length > 0 ? ', ' : ''}`;
        if (callee.type == null || callee.type.name !== 'function') {
          throw new Error(`Called expression must be a function and is ${JSON.stringify(callee)}`);
          val = `${callee.val}(${heapParams}${path.node.arguments.map((e) => parseExpression(e).val).join(', ')})`;
          return false;
        }
        // throw new Error(`Called expression must be a function and is ${JSON.stringify(callee)}`);

        type = callee.type.returnType;
        val = `${callee.val}(${callee.type.useHeap ? heapParams : ''}${path.node.arguments
          .map((e) => parseExpression(e).val)
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
        const right = parseExpression(path.node.right);
        if (right.type.name === 'object' && !(right.type.orphan ?? false))
          throw new Error('Cannot reasign objects (did you mean to use this.copy(obj))');

        if (right.type.name === 'object' && (right.type.orphan ?? false)) {
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

        const properties: Record<string, TypeInfo> = props.reduce(
          (obj, { key, value }) => ({
            ...obj,
            [key]: value.type,
          }),
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

    const asType = type as TypeInfo;
    if (asType.name === 'object' && asType.global) {
      // console.log({ val: `(${val})`, type: { ...asType, global: false } });
      return { val: `(${val})`, type: { ...asType, global: false } };
    }

    return { val, type };
  }
}
