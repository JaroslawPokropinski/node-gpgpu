import * as esprima from 'esprima';

import { StatementParser } from './statementParser';
import ObjectSerializer from './objectSerializer';
import { ExpressionParser, TypeInfo, getTypeInfoText } from './expressionParser';
import { DeclarationTable } from './declarationTable';

export type FunctionType = {
  type: string;
  readWrite: string;
  shape?: unknown;
  shapeObj?: unknown;
};

export interface KernelContext {
  // eslint-disable-next-line @typescript-eslint/ban-types
  func: Record<string, Function>;
  INFINITY: number;

  get_global_id(dim: number): number;
  sqrt(n: number): number;
}

export type SimpleFunctionType = {
  name?: string;
  return?: string;
  returnObj?: unknown;
  shape?: string[];
  shapeObj?: unknown[];
  body: (this: KernelContext, ...args: never[]) => void;
};

const paramMap = new Map<string, [TypeInfo | null, Buffer[]]>();

const argumentHandlers = new Map<string, (name: string) => string>();
argumentHandlers.set('Float32Array', (name) => `__global float *${name}`);
argumentHandlers.set('Float64Array', (name) => `__global double *${name}`);
argumentHandlers.set('Object', (name) => {
  const param = paramMap.get(name)?.[0];
  if (param == null) throw new Error('Unknown argument type');
  if (param.name !== 'object') throw new Error('Object argument must be an object');

  return `global ${param.objType}* ${name}`;
  // return `${getTypeInfoText(param)} ${name}`;
});
argumentHandlers.set('Object[]', (name) => {
  const param = paramMap.get(name)?.[0];
  if (param == null) throw new Error('Unknown argument type');

  return `${getTypeInfoText(param)} ${name}`;
});

function handleArgType(name: string, type: FunctionType): string {
  return (
    argumentHandlers.get(type.type) ??
    (() => {
      throw new Error('Unhandled argument type');
    })
  )(name);
}

const malloc = `global void* malloc(size_t size, global uchar *heap, global uint *next)
{
  uint index = atomic_add(next, size);
  return heap+index;
}`;

export function translateFunction(
  func: (...args: unknown[]) => void,
  types: FunctionType[],
  shapes: unknown[],
  functions: SimpleFunctionType[],
): string {
  const jscode = `(${func.toString()})`;
  const program = esprima.parseScript(jscode);
  const st = program.body[0];

  const declarationTable = new DeclarationTable();
  const objSerializer = new ObjectSerializer(declarationTable);
  const expressionParser = new ExpressionParser(declarationTable);
  const statementParser = new StatementParser(declarationTable, expressionParser);
  const parseStatement = (ast: Parameters<StatementParser['parseStatement']>[0]) => statementParser.parseStatement(ast);

  if (st.type === 'ExpressionStatement' && st.expression.type === 'FunctionExpression') {
    const fucts = functions
      .map((f) => {
        const pf = esprima.parseScript(f.body.toString()).body[0];
        if (pf.type === 'FunctionDeclaration') {
          const name = f.name ?? pf.id?.name;
          if (name == null) throw new Error('Declared function must have name or identifier');

          const shape = /*f.shape ??*/ f.shapeObj?.map((obj) => objSerializer.serializeObject(obj, false)[0]);
          if (shape == null) throw new Error('Shape or shapeObj must be provided');

          const returnObj = f.returnObj != null ? objSerializer.serializeObject(f.returnObj, false)[0] : null;
          const ret = /*f.return ??*/ returnObj;
          if (ret == null) throw new Error('Return or returnObj must be provided');

          // this.func.name <- set type to f type
          declarationTable.addFunction({ name, returnType: ret });

          return `${getTypeInfoText(ret)} ${name}(${shape
            .map((t, i) => {
              const pi = pf.params[i];
              if (pi.type === 'Identifier') {
                // TODO: Change that
                const tp = t ?? { name: 'int' };
                declarationTable.declareVariable(pi.name, tp);
                // declarationTable.declareVariable(pi.name, { name: 'object', global: false, objType: objSerializer.serializeObject() });
                return `${getTypeInfoText(tp)} ${pi.name}`;
              }
              throw new Error('Function params must be identifiers');
            })
            .join(', ')}) {\n${parseStatement(pf.body)}\n}`;
        }
      })
      .join('\n');
    const spTuples = st.expression.params
      .map((p, i) => [p.type === 'Identifier' ? p.name : '', types[i]] as [string, FunctionType])
      .filter(([, t]) => t.type === 'Object' || t.type === 'Object[]')
      .map(([p], i) => [p, shapes[i]] as [string, unknown]);
    spTuples.forEach(([p, s]) => {
      const r = objSerializer.serializeObject(s);
      paramMap.set(p, r);
    });
    const params = st.expression.params
      .map((p, idx) => {
        if (p.type === 'Identifier') {
          // TODO: Change that
          const param = paramMap.get(p.name)?.[0];
          const tp: TypeInfo =
            param ??
            (types[idx].type === 'Float32Array' || types[idx].type === 'Float64Array'
              ? { name: 'array', contentType: { name: 'double' } }
              : null ?? { name: 'int' });
          declarationTable.declareVariable(p.name, tp);
          return handleArgType(p.name, types[idx]);
        } else {
          throw new Error(`Unsupported function argument type: ${p.type}`);
        }
      })
      .join(', ');
    const code = st.expression.body.body.map((st) => parseStatement(st)).join('\n');
    const classes = objSerializer.getClasses();
    return `${malloc}\n\n${classes}\n\n${fucts}\n\n__kernel void kernelFunc(global uchar *heap, global uint *next${
      params.length > 0 ? ', ' : ''
    }${params}) {\n${code}\n}`;
  }
  throw new Error('Bad function construction');
}
