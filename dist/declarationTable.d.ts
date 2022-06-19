import { TypeInfo } from './expressionParser';
export declare class DeclarationTable {
    _genClassesCount: number;
    _classesMap: Map<string, string>;
    _initializersMap: Map<string, string>;
    _functions: {
        name: string;
        returnType: TypeInfo;
    }[];
    _varMap: Map<string, TypeInfo>;
    addFunction(f: {
        name: string;
        returnType: TypeInfo;
    }): void;
    getObject(sig: [string, string][]): string;
    declareVariable(name: string, type: TypeInfo): void;
    getClassesDefinition(): string;
    getVarType(name: string): TypeInfo;
}
