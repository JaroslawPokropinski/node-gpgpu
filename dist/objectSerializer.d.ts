/// <reference types="node" />
import { DeclarationTable } from './declarationTable';
import { TypeInfo } from './expressionParser';
export default class ObjectSerializer {
  classes: string[];
  classesMap: Map<string, string>;
  ccount: number;
  _declarationTable?: DeclarationTable;
  constructor(declarationTable?: DeclarationTable);
  serializeObject(o: unknown, kparam?: boolean): [TypeInfo | null, Buffer[]];
  getClasses(): string;
}
