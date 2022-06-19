import * as recast from 'recast';
import { DeclarationTable } from './declarationTable';
export declare class ExpressionContext {
    static count: number;
    variables: {
        name: string;
        value?: string | undefined;
        type: TypeInfo;
    }[];
    declareVariable(type: TypeInfo, value?: string): string;
    toString(): string;
}
declare type ScalarType = {
    name: 'int';
} | {
    name: 'uint';
} | {
    name: 'long';
} | {
    name: 'ulong';
};
declare type DoubleInfo = {
    name: 'double';
};
declare type FunctionInfo = {
    name: 'function';
    returnType: TypeInfo;
};
declare type GenFunctionInfo = {
    name: 'gfunction';
};
declare type ArrayInfo = {
    name: 'array';
    contentType: TypeInfo;
};
declare type ObjectInfo = {
    name: 'object';
    global: boolean;
    reference?: boolean;
    objType: string;
    orphan?: boolean;
    rvalue?: boolean;
    properties: Record<string, TypeInfo>;
};
export declare type TypeInfo = ScalarType | DoubleInfo | FunctionInfo | GenFunctionInfo | ArrayInfo | ObjectInfo;
export declare function getTypeInfoText(ti: TypeInfo): string;
export declare class ExpressionParser {
    _declarationTable: DeclarationTable;
    constructor(declarationTable: DeclarationTable);
    parseExpression(ast: recast.types.ASTNode, context: ExpressionContext, ignoreType?: boolean): {
        val: string;
        type: TypeInfo;
    };
}
export {};
