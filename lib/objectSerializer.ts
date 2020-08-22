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
