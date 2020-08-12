export default class ObjectSerializer {
  classes: string[] = [];
  classesMap = new Map<string, string>();
  ccount = 0;

  serializeObject(o: unknown): [string, Buffer[]] {
    const toSerialize: [Buffer[], number, Buffer][] = [];

    const _serializeObject = (
      o: unknown,
      arr: Buffer[] = [],
      name: string | null = null,
    ): [string, Buffer[], string?] => {
      if (typeof o === 'boolean') {
        const buf = Buffer.allocUnsafe(1);
        buf.writeUInt8(o ? 1 : 0, 0);
        arr.push(buf);
        return [`bool`, arr];
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
          if (name == null) throw new Error();

          const buf = Buffer.alloc(16);
          buf.writeUIntLE(o.length, 0, 6);
          buf.writeUIntLE(0, 8, 6);
          arr.push(buf);

          const arrSer: Buffer[] = [];
          const arrDef = `size_t ${name}_length;\n${_serializeObject(o[0], arrSer)[0]}*`;
          for (let i = 1; i < o.length; i++) {
            _serializeObject(o[i], arrSer);
          }
          toSerialize.push([arrSer, 4, buf]);
          return [arrDef, arr];
        } else {
          const name = `GenClass${this.ccount}`;
          this.ccount++;
          const obj = `{\n${Object.entries(o)
            .map(([key, value]) => `${_serializeObject(value, arr, key)[0]} ${key};\n`)
            .join('')}}`;
          if (!this.classesMap.has(obj)) {
            this.classesMap.set(obj, name);
            this.classes.push(`class ${name} ${obj}`);
            return [name, arr, name];
          } else {
            return [this.classesMap.get(obj) ?? '', arr, name];
          }
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
    const classes: string[] = [];
    this.classesMap.forEach((val, key) => classes.push(`typedef struct ${key} ${val};`));

    return classes.join('\n\n');
  }
}
