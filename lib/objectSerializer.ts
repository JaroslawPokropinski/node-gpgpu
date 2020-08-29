import { DeclarationTable } from './declarationTable';
import { TypeInfo, getTypeInfoText } from './expressionParser';

export default class ObjectSerializer {
  classes: string[] = [];
  classesMap = new Map<string, string>();
  ccount = 0;
  _declarationTable?: DeclarationTable;

  constructor(declarationTable?: DeclarationTable) {
    this._declarationTable = declarationTable;
  }

  serializeObject(o: unknown, kparam = true): [TypeInfo | null, Buffer[]] {
    const _serializeObject = (o: unknown, arr: Buffer[] = []): [TypeInfo | null, Buffer[]] => {
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
          const properties: Record<string, TypeInfo> = {};
          const obj = Object.entries(o[0]).map<[string, string]>(([key, value]) => {
            const typeOfObj = _serializeObject(value, arr)[0];
            properties[key] = typeOfObj ?? { name: 'int' };
            return [typeOfObj != null ? getTypeInfoText(typeOfObj) : '', key];
          });

          if (this._declarationTable != null) {
            const name = this._declarationTable.getObject(obj);

            return [{ name: 'array', contentType: { name: 'object', global: false, objType: name, properties } }, arr];
          }
          return [null, arr];
        } else {
          const properties: Record<string, TypeInfo> = {};
          const obj = Object.entries(o).map<[string, string]>(([key, value]) => {
            const typeOfObj = _serializeObject(value, arr)[0];
            properties[key] = typeOfObj ?? { name: 'int' };
            return [typeOfObj != null ? getTypeInfoText(typeOfObj) : '', key];
          });

          if (this._declarationTable != null) {
            const name = this._declarationTable.getObject(obj);

            return [{ name: 'object', global: kparam, objType: name, properties }, arr];
          }
          return [null, arr];
        }
      }
      return [null, arr];
    };

    return _serializeObject(o);
  }

  getClasses(): string {
    if (this._declarationTable == null) {
      throw new Error('Failed to generate classes without declaration table');
    }
    return this._declarationTable.getClassesDefinition();
  }
}
