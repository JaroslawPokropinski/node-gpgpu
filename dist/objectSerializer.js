'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const expressionParser_1 = require('./expressionParser');
const compareEntries = (a, b) => {
  if (a[0] < b[0]) {
    return -1;
  }
  if (a[0] > b[0]) {
    return 1;
  }
  return 0;
};
class ObjectSerializer {
  constructor(declarationTable) {
    this.classes = [];
    this.classesMap = new Map();
    this.ccount = 0;
    this._declarationTable = declarationTable;
  }
  serializeObject(o, kparam = true) {
    const _serializeObject = (o, arr = []) => {
      if (o instanceof Float32Array) throw new Error('Cannot serialize Float32Array');
      if (typeof o === 'boolean') {
        const buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(o ? 1 : 0, 0);
        arr.push(buf);
        return [{ name: 'int' }, arr];
      } else if (typeof o === 'string') {
        throw new Error('Unsupported string type');
      } else if (typeof o === 'number') {
        const buf = Buffer.allocUnsafe(8);
        buf.writeDoubleLE(o, 0);
        arr.push(buf);
        return [{ name: 'double' }, arr];
      } else if (typeof o === 'object') {
        if (o == null) {
          return [null, arr];
        }
        if (Array.isArray(o)) {
          const properties = {};
          const obj = Object.entries(o[0]).map(([key, value]) => {
            const typeOfObj = _serializeObject(value, arr)[0];
            properties[key] = typeOfObj !== null && typeOfObj !== void 0 ? typeOfObj : { name: 'int' };
            return [typeOfObj != null ? (0, expressionParser_1.getTypeInfoText)(typeOfObj) : '', key];
          });
          if (this._declarationTable != null) {
            const name = this._declarationTable.getObject(obj);
            return [
              {
                name: 'array',
                contentType: { name: 'object', global: false, objType: name, properties, orphan: true, rvalue: true },
              },
              arr,
            ];
          }
          return [null, arr];
        } else {
          const properties = {};
          const obj = Object.entries(o)
            .sort(compareEntries)
            .map(([key, value]) => {
              // const t = this.serializeObject(value, false);
              // const typeOfObj = t[0];
              // arr.push(...t[1]);
              const typeOfObj = _serializeObject(value, arr)[0];
              properties[key] = typeOfObj !== null && typeOfObj !== void 0 ? typeOfObj : { name: 'int' };
              return [typeOfObj != null ? (0, expressionParser_1.getTypeInfoText)(typeOfObj) : '', key];
            });
          if (this._declarationTable != null) {
            const name = this._declarationTable.getObject(obj);
            return [{ name: 'object', global: kparam, objType: name, properties, orphan: true, rvalue: true }, arr];
          }
          return [null, arr];
        }
      }
      return [null, arr];
    };
    return _serializeObject(o);
  }
  getClasses() {
    if (this._declarationTable == null) {
      throw new Error('Failed to generate classes without declaration table');
    }
    return this._declarationTable.getClassesDefinition();
  }
}
exports.default = ObjectSerializer;
