import { DeclarationTable } from './declarationTable';

export default class ObjectSerializer {
  classes: string[] = [];
  classesMap = new Map<string, string>();
  ccount = 0;
  _declarationTable?: DeclarationTable;

  constructor(declarationTable?: DeclarationTable) {
    this._declarationTable = declarationTable;
  }

  serializeObject(o: unknown): [string, Buffer[]] {
    const toSerialize: [Buffer[], number, Buffer][] = [];

    const _serializeObject = (o: unknown, arr: Buffer[] = []): [string, Buffer[], string?] => {
      if (typeof o === 'boolean') {
        const buf = Buffer.allocUnsafe(4);
        buf.writeUInt32LE(o ? 1 : 0, 0);
        arr.push(buf);
        return [`int`, arr];
      } else if (typeof o === 'string') {
        return [`string`, arr];
      } else if (typeof o === 'number') {
        const buf = Buffer.allocUnsafe(8);
        buf.writeDoubleLE(o, 0);
        arr.push(buf);
        // arr.push(o);
        return [`double`, arr];
      } else if (typeof o === 'object') {
        if (o == null) {
          return ['null', arr];
        }
        if (Array.isArray(o)) {
          throw new Error('Cannot serialize array');
        } else {
          const obj = Object.entries(o).map<[string, string]>(([key, value]) => [_serializeObject(value, arr)[0], key]);

          if (this._declarationTable != null) {
            const name = this._declarationTable.getObject(obj);
            return [name, arr];
          }
          return ['', arr];
        }
      }
      return ['', arr];
    };
    const [name, data] = _serializeObject(o);
    // TODO: change
    toSerialize.forEach(([]) => {
      // sum buffer sizes
      // place positions in buffers
    });
    return [name, data];
  }

  getClasses(): string {
    if (this._declarationTable == null) {
      throw new Error('Failed to generate classes without declaration table');
    }
    return this._declarationTable.getClassesDefinition();
  }
}
