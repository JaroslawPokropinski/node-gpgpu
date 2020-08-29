import { TypeInfo } from './expressionParser';
import { SimpleFunctionType } from './parser';
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
    this._initializersMap.set(
      name,
      `global ${name}* new${name}(global uchar *heap, global uint *next${sig.length > 0 ? ', ' : ''}${sig
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([type, name]) => `${type} ${name}`)
        .join(', ')}){\nglobal ${name}*t = malloc(sizeof(${name}), heap, next);\n${sig
        .map(([, name]) => `t->${name} = ${name};`)
        .join('\n')}\nreturn t;\n}`,
    );
    return name;
  }

  declareVariable(name: string, type: TypeInfo): void {
    this._varMap.set(name, type);
  }

  getClassesDefinition(): string {
    const classes: string[] = [];
    this._classesMap.forEach((val, key) => classes.push(`typedef struct ${key} ${val};`));
    this._initializersMap.forEach((val) => classes.push(val));

    return classes.join('\n\n');
  }

  getVarType(name: string): TypeInfo {
    const typeOpt = this._varMap.get(name);
    if (typeOpt == null) throw new Error(`Cannot use not declared variable: ${name}`);
    return typeOpt;
  }
}
