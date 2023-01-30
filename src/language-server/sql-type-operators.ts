/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from "lodash";
import { BinaryExpression } from "./generated/ast";
import { TypeDescriptor, Types } from "./sql-type-descriptors";

export type BinaryOperator = BinaryExpression["operator"];

export interface BinaryOperatorDescriptor {
    left: TypeDescriptor;
    right: TypeDescriptor;
    returnType: TypeDescriptor;
}

const IntegerIntegerReturnsInteger: BinaryOperatorDescriptor = {
    left: Types.Integer,
    right: Types.Integer,
    returnType: Types.Integer
}

const RealRealReturnsReal: BinaryOperatorDescriptor = {
    left: Types.Real,
    right: Types.Real,
    returnType: Types.Real
}

const IntegerIntegerReturnsBoolean: BinaryOperatorDescriptor = {
    left: Types.Integer,
    right: Types.Integer,
    returnType: Types.Boolean
} 


const RealRealReturnsBoolean: BinaryOperatorDescriptor = {
    left: Types.Real,
    right: Types.Real,
    returnType: Types.Boolean
}

const BooleanBooleanReturnsBoolean: BinaryOperatorDescriptor = {
    left: Types.Boolean,
    right: Types.Boolean,
    returnType: Types.Boolean
}

const CharCharReturnsBoolean: BinaryOperatorDescriptor = {
    left: Types.Char(),
    right: Types.Char(),
    returnType: Types.Boolean
}

const ReveresedBinaryOperators: Map<BinaryOperatorDescriptor, BinaryOperator[]> = new Map<BinaryOperatorDescriptor, BinaryOperator[]>();
ReveresedBinaryOperators.set(IntegerIntegerReturnsInteger, ["%", "*", "+", "-", "/"]);
ReveresedBinaryOperators.set(RealRealReturnsReal, ["%", "*", "+", "-", "/"]);
ReveresedBinaryOperators.set(IntegerIntegerReturnsBoolean, ["<", "<=", "<>", "=", ">", ">="]);
ReveresedBinaryOperators.set(RealRealReturnsBoolean, ["<", "<=", "<>", "=", ">", ">="]);
ReveresedBinaryOperators.set(CharCharReturnsBoolean, ["<", "<=", "<>", "=", ">", ">="]);
ReveresedBinaryOperators.set(BooleanBooleanReturnsBoolean, ["<", "<=", "<>", "=", ">", ">=", "AND", "OR"]);

const flatMap = [...ReveresedBinaryOperators.entries()].flatMap(([descr, operators]) => {
    return operators.map(op => [op, descr] as const);
});

export type BinaryOperatorTable = Record<BinaryOperator, BinaryOperatorDescriptor[]>;

function emptyTable(): BinaryOperatorTable {
    const result: any = {};
    const indices: BinaryOperator[] = ["%", "*", "+", "-", "/", "<", "<=", "<>", "=", ">", ">=", "AND", "OR"];
    indices.forEach(op => result[op] = []);
    return result as BinaryOperatorTable;
}

export const BinaryOperators = Object.entries(_.groupBy(flatMap, ([op]) => op))
    .reduce((lhs, rhs) => {
        const key: BinaryOperator = rhs[0] as BinaryOperator;
        lhs[key] = lhs[key].concat(rhs[1].map(descr => descr[1]));
        return lhs;
    }, emptyTable());
