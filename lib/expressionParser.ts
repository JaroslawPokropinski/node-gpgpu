import * as recast from 'recast';

export function parseExpression(ast: recast.types.ASTNode): string {
  let val: string | null = null;
  recast.visit(ast, {
    visitIdentifier(path) {
      val = path.node.name;
      return false;
    },
    visitLiteral(path) {
      val = path.node.value?.toString() || 'null';
      return false;
    },
    visitBinaryExpression(path) {
      val = `${parseExpression(path.node.left)} ${path.node.operator} ${parseExpression(path.node.right)}`;
      return false;
    },
    visitMemberExpression(path) {
      if (path.node.computed) {
        val = `${parseExpression(path.node.object)}[(size_t)(${parseExpression(path.node.property)})]`;
      } else if (path.node.object.type === 'ThisExpression') {
        val = parseExpression(path.node.property);
      } else {
        console.log(path.node.object.type);
        if (path.node.object.type === 'MemberExpression') {
          val = `${parseExpression(path.node.object)}.${parseExpression(path.node.property)}`;
        } else {
          val = `${parseExpression(path.node.object)}->${parseExpression(path.node.property)}`;
        }
      }
      return false;
    },
    visitCallExpression(path) {
      val = `${parseExpression(path.node.callee)}(${path.node.arguments.map((e) => parseExpression(e)).join(', ')})`;
      return false;
    },
    visitThisExpression() {
      val = '';
      return false;
    },
    visitExpression(path) {
      throw new Error(`Unsupported expression: ${path.node.type}`);
    },
  });

  if (val == null) {
    throw new Error(`Failed to parse a expression (got null)`);
  }

  return val;
}
