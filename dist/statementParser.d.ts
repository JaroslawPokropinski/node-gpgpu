import * as recast from 'recast';
import { ExpressionParser } from './expressionParser';
import { DeclarationTable } from './declarationTable';
export declare class StatementParser {
  _declarationTable: DeclarationTable;
  _expressionParser: ExpressionParser;
  constructor(declarationTable: DeclarationTable, expressionParser: ExpressionParser);
  parseStatement(ast: recast.types.ASTNode): string;
}
