/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { MySqlDialectTypes } from "./dialects/mysql/data-types";
import { SqlDialectTypes } from "./dialects/sql/data-types";
import { isNumberLiteral, isStringLiteral } from "./generated/ast";
import { AST as ast, SqlServices } from "./index";
export type TypeString = string;

export interface DialectTypeList<T> {
    strings: T[];
    integers: T[];
    reals: T[];
    dateTimes: T[];
    booleans: T[];
    blobs: T[];
    enums: T[];
}

export interface DataTypeArgument {
    type: 'string' | 'real' | 'integer' | 'size';
    optional: boolean;
}

export interface DataTypeDefinition {
    names: string[];
    arguments: DataTypeArgument[];
}

function areEqual(ast: ast.DataType, required: DataTypeDefinition): boolean {
    if (ast.dataTypeNames.length !== required.names.length) {
        return false;
    }
    for (let i = 0; i < ast.dataTypeNames.length; i++) {
        if (ast.dataTypeNames[i].toUpperCase() !== required.names[i].toUpperCase()) {
            return false;
        }
    }
    if (ast.arguments.length > required.arguments.length) {
        return false;
    }
    for (let i = 0; i < ast.arguments.length; i++) {
        const arg = ast.arguments[i];
        const requiredArg = required.arguments[i];
        if (isNumberLiteral(arg)) {
            switch(requiredArg.type) {
                case 'integer':
                    if (!Number.isInteger(arg.value)) {
                        return false;
                    }
                    break;
                case 'real':
                    break;
                case 'size':
                    if (!Number.isInteger(arg.value) || arg.value < 0) {
                        return false;
                    }
                    break;
                default:
                    return false;
            }
        }
        if (isStringLiteral(arg) && requiredArg.type !== 'string') {
            return false;
        }
    }
    for (let i = ast.arguments.length; i < required.arguments.length; i++) {
        if (!required.arguments[i].optional) {
            return false;
        }
    }
    return true;
}

export function parseRequiredType(str: TypeString): DataTypeDefinition {
    const namesExpression = /^(\w+)(\s+(\w+))*\s*(\([^\)]+\))?$/
    const namesMatch = str.match(namesExpression);
    if(!namesMatch) {
        throw new Error(`Invalid type string: ${str}`);
    }
    const names: string[] = [];
    for(let index = 1; index < namesMatch.length; index+=2) {
        const name = namesMatch[index];
        name && names.push(name);
    }
    const args: DataTypeArgument[] = [];
    const argsString = namesMatch[namesMatch.length - 1];
    if(argsString) {
        const trimmedArgsString = argsString.substring(1, argsString.length - 1).split(',').map(s => s.trim());
        for(const arg of trimmedArgsString) {
            const match = arg.match(/^(string|real|integer|size)(\?)?$/);
            if(match) {
                args.push({
                    type: match[1] as ('string' | 'real' | 'integer' | 'size'),
                    optional: match[2] === '?'
                });
            } else {
                throw new Error(`Invalid argument type: ${arg}`);
            }
        }
    }
    return {
        names,
        arguments: args
    }    
}

export class DialectTypes {
    private readonly types: DialectTypeList<DataTypeDefinition>;
    constructor(types: DialectTypeList<TypeString>) {
        this.types = Object.entries(types).reduce((acc, [key, value]) => {
            acc[key as keyof DialectTypeList<string>] = value.map(parseRequiredType);
            return acc;
        }, {} as DialectTypeList<DataTypeDefinition>);
    }
    isStringDataType(dataType: ast.DataType): boolean {
        return this.types.strings.some(t => areEqual(dataType, t));
    }
    isIntegerDataType(dataType: ast.DataType): boolean {
        return this.types.integers.some(t => areEqual(dataType, t));
    }
    isRealDataType(dataType: ast.DataType): boolean {
        return this.types.reals.some(t => areEqual(dataType, t));
    }
    isDateTimeDataType(dataType: ast.DataType): boolean {
        return this.types.dateTimes.some(t => areEqual(dataType, t));
    }
    isBooleanDataType(dataType: ast.DataType): boolean {
        return this.types.booleans.some(t => areEqual(dataType, t));
    }
    isBlobDataType(dataType: ast.DataType): boolean {
        return this.types.blobs.some(t => areEqual(dataType, t));
    }
    isEnumDataType(dataType: ast.DataType): boolean {
        return this.types.enums.some(t => areEqual(dataType, t));
    }
}

export function typesExtend<T>(a: DialectTypeList<T>, b: DialectTypeList<T>): DialectTypeList<T> {
    return {
        strings: [...a.strings, ...b.strings],
        integers: [...a.integers, ...b.integers],
        reals: [...a.reals, ...b.reals],
        dateTimes: [...a.dateTimes, ...b.dateTimes],
        booleans: [...a.booleans, ...b.booleans],
        blobs: [...a.blobs, ...b.blobs],
        enums: [...a.enums, ...b.enums]
    };
}