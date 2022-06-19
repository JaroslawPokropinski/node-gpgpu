'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.DeclarationTable = void 0;
class DeclarationTable {
  constructor() {
    this._genClassesCount = 0;
    this._classesMap = new Map();
    this._initializersMap = new Map();
    this._functions = [];
    this._varMap = new Map();
  }
  addFunction(f) {
    this._functions.push(f);
  }
  getObject(sig) {
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
  declareVariable(name, type) {
    this._varMap.set(name, type);
  }
  getClassesDefinition() {
    const classes = [];
    this._classesMap.forEach((val, key) => classes.push(`typedef struct ${key} ${val};`));
    return classes.join('\n\n');
  }
  getVarType(name) {
    const typeOpt = this._varMap.get(name);
    if (typeOpt == null) throw new Error(`Cannot use not declared variable: ${name}`);
    return typeOpt;
  }
}
exports.DeclarationTable = DeclarationTable;
