import * as recast from 'recast';
import { DeclarationTable } from './declarationTable';
import { SimpleFunctionType } from './parser';

type IntInfo = { name: 'int' };
type DoubleInfo = { name: 'double' };
type FunctionInfo = { name: 'function'; returnType: TypeInfo; useHeap: boolean };
type ArrayInfo = { name: 'array'; contentType: TypeInfo };
type ObjectInfo = { name: 'object'; global: boolean; objType: string; properties: Record<string, TypeInfo> };

export type TypeInfo = IntInfo | DoubleInfo | FunctionInfo | ArrayInfo | ObjectInfo;
export function getTypeInfoText(ti: TypeInfo): string {
  if (ti.name === 'int' || ti.name === 'double') {
    return ti.name;
  }
  if (ti.name === 'object') {
    if (ti.global) {
      return `${ti.objType}`;
      // return `global ${ti.objType}*`;
    }

    return `global ${ti.objType}*`;
  }

  if (ti.name === 'array') {
    return getTypeInfoText(ti.contentType);
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
            // val = `(&${val})`;
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
        val = `${left.val} ${path.node.operator} ${parseExpression(path.node.right).val}`;
        type = left.type;

        return false;
      },
      visitMemberExpression(path) {
        // Many changes to be done here (refactor this later)
        if (path.node.computed) {
          const object = parseExpression(path.node.object);
          if (object.type.name !== 'array') throw new Error(`Expected array got: ${object.type.name}`);
          if (object.type.contentType.name === 'object') {
            val = `(&${object.val}[(size_t)(${parseExpression(path.node.property).val})])`;
          } else {
            val = `${object.val}[(size_t)(${parseExpression(path.node.property).val})]`;
          }
          type = object.type.contentType;
        } else if (path.node.object.type === 'ThisExpression') {
          // const prop = parseExpression(path.node.property);
          const that = parseExpression(path.node.object);

          if (path.node.property.type !== 'Identifier' || that.type == null || that.type.name !== 'object') {
            throw new Error('Bad member expression with this');
          }
          val = path.node.property.name;
          type = that.type.properties[path.node.property.name];
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
            sep = left.type.global ? '.' : '->';
          } else {
            console.log(path.node.property.type, left.type);
            // throw new Error('Bad member expression');
          }
          val = `${left.val}${sep}${path.node.property.name}`;
        }

        return false;
      },
      visitCallExpression(path) {
        const callee = parseExpression(path.node.callee);
        if (callee.type == null || callee.type.name !== 'function') {
          // throw new Error('Called expression must be a function');
          return false;
        }

        const heapParams = callee.type.useHeap ? `heap, next${path.node.arguments.length > 0 ? ', ' : ''}` : '';

        type = callee.type.returnType;
        val = `${callee.val}(${heapParams}${path.node.arguments.map((e) => parseExpression(e).val).join(', ')})`;

        return false;
      },
      visitThisExpression() {
        val = '';
        type = {
          name: 'object',
          global: false,
          objType: 'void',
          properties: {
            INFINITY: { name: 'double' },
            get_global_id: { name: 'function', returnType: { name: 'int' }, useHeap: false },
            sqrt: { name: 'function', returnType: { name: 'double' }, useHeap: false },
          },
        };
        return false;
      },
      visitAssignmentExpression(path) {
        const right = parseExpression(path.node.right);
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

        const objName = declarationTable.getObject(
          props.map((prop) => [
            // prop.value.type.name !== 'object' ? prop.value.type.name : prop.value.type.objType,
            getTypeInfoText(prop.value.type),
            prop.key,
          ]),
        );

        // val = `(${objName}){ ${props.map((p) => `.${p.key.val} = ${p.value.val}`).join(', ')} }`;
        // val = `malloc(sizeof(${objName}), heap, next)`;

        const properties: Record<string, TypeInfo> = props.reduce(
          (obj, { key, value }) => ({
            ...obj,
            [key]: value.type,
          }),
          {},
        );

        val = `new${objName}(heap, next${props.length > 0 ? ', ' : ''}${props.map((p) => p.value.val).join(', ')})`;
        type = { name: 'object', global: false, objType: `${objName}`, properties };
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
      console.log({ val: `(&${val})`, type: { ...asType, global: false } });
      return { val: `(&${val})`, type: { ...asType, global: false } };
    }

    return { val, type };
  }
}
