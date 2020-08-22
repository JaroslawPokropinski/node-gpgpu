import * as recast from 'recast';

interface TypeInfo {
  getText(): string;
}

// class StructType implements TypeInfo {
//   text: string;
//   constructor(leftInfo: TypeInfo, param: string) {

//   }
// }

export function parseExpression(ast: recast.types.ASTNode): { val: string; type: TypeInfo | null } {
  let val: string | null = null;
  const type: TypeInfo | null = null;
  recast.visit(ast, {
    visitIdentifier(path) {
      val = path.node.name;
      return false;
    },
    visitLiteral(path) {
      val = path.node.value?.toString() || 'null';
      return false;
    },
    visitUpdateExpression({ node }) {
      val = `${node.prefix ? node.operator : ''}${parseExpression(node.argument).val}${
        !node.prefix ? node.operator : ''
      }`;
      return false;
    },
    visitUnaryExpression(path) {
      val = `${path.node.operator}${parseExpression(path.node.argument).val}`;
      return false;
    },
    visitBinaryExpression(path) {
      val = `${parseExpression(path.node.left).val} ${path.node.operator} ${parseExpression(path.node.right).val}`;
      return false;
    },
    visitMemberExpression(path) {
      // Many changes to be done here (refactor this later)
      if (path.node.computed) {
        val = `${parseExpression(path.node.object).val}[(size_t)(${parseExpression(path.node.property).val})]`;
      } else if (path.node.object.type === 'ThisExpression') {
        val = parseExpression(path.node.property).val;
      } else {
        console.log(path.node.object.type);
        if (path.node.object.type === 'MemberExpression') {
          val = `${parseExpression(path.node.object).val}.${parseExpression(path.node.property).val}`;
        } else {
          val = `${parseExpression(path.node.object).val}.${parseExpression(path.node.property).val}`;
        }
      }
      return false;
    },
    visitCallExpression(path) {
      val = `${parseExpression(path.node.callee).val}(${path.node.arguments
        .map((e) => parseExpression(e).val)
        .join(', ')})`;
      return false;
    },
    visitThisExpression() {
      val = '';
      return false;
    },
    visitAssignmentExpression(path) {
      val = `${parseExpression(path.node.left).val} ${path.node.operator} ${parseExpression(path.node.right).val}`;
      return false;
    },
    visitLogicalExpression({ node }) {
      val = `${parseExpression(node.left).val} ${node.operator} ${parseExpression(node.right).val}`;
      return false;
    },
    visitExpression(path) {
      throw new Error(`Unsupported expression: ${path.node.type}`);
    },
  });

  if (val == null) {
    throw new Error(`Failed to parse a expression (got null)`);
  }

  return { val, type };
}
