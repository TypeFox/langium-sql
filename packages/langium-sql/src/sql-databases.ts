/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { match } from "assert";
import { isNumberLiteral, isStringLiteral } from "./generated/ast";
import { AST as ast } from "./index";

export type DatabaseDialect = "SQL" | "Oracle" | "MySQL" | "PostgreSQL" | "SQLServer" | "Presto";

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

export interface DataType {
    names: string[];
    arguments: DataTypeArgument[];
}

function areEqual(ast: ast.DataType, required: DataType): boolean {
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
            return false;
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

export function parseRequiredType(str: TypeString): DataType {
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

/*
export class DialectTypes {
    constructor(types: DialectTypeList<TypeString>) {
        
    }
    isStringDataType(dataType: ast.DataType): boolean;
    isIntegerDataType(dataType: ast.DataType): boolean;
    isRealDataType(dataType: ast.DataType): boolean;
    isDateTimeDataType(dataType: ast.DataType): boolean;
    isBooleanDataType(dataType: ast.DataType): boolean;
    isBlobDataType(dataType: ast.DataType): boolean;
    isEnumDataType(dataType: ast.DataType): boolean;
}
*/