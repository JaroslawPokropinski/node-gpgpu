import { TypeInfo } from './expressionParser';
export class DeclarationTable {
  _genClassesCount = 0;
  _classesMap = new Map<string, string>();
  _initializersMap = new Map<string, string>();
  _functions: { name: string; returnType: TypeInfo }[] = [];

  _varMap = new Map<string, TypeInfo>();

  addFunction(f: { name: string; returnType: TypeInfo }): void {
    this._functions.push(f);
  }

  getObject(sig: [string, string][]): string {
    const code = `{${sig
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([type, name]) => `${type} ${name};`)
      .join('\n')}}`;
    const nameOpt = this._classesMap.get(code);
    if (nameOpt != null) {
      return nameOpt;
    }

    const name = `GenClass${this._genClassesCount++}`;
    this._classesMap.set(code, name);

    return name;
  }

  declareVariable(name: string, type: TypeInfo): void {
    this._varMap.set(name, type);
  }

  getClassesDefinition(): string {
    const classes: string[] = [];
    this._classesMap.forEach((val, key) => classes.push(`typedef struct ${key} ${val};`));

    return classes.join('\n\n');
  }

  getVarType(name: string): TypeInfo {
    const typeOpt = this._varMap.get(name);
    if (typeOpt == null) throw new Error(`Cannot use not declared variable: ${name}`);

    return typeOpt;
  }
}
