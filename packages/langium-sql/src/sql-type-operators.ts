/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from "lodash";
import { BinaryExpression, NegatableExpression, UnaryExpression } from "./generated/ast.js";
import { TypeDescriptor, Types } from "./sql-type-descriptors.js";

export type UnaryOperator = UnaryExpression["operator"];
export type BinaryOperator = BinaryExpression["operator"] | NegatableExpression['operator'];

export interface UnaryOperatorDescriptor {
    operandType: TypeDescriptor;
    returnType: TypeDescriptor;
}

const IntegerReturnsInteger: UnaryOperatorDescriptor = {
    operandType: Types.Integer,
    returnType: Types.Integer
}

const RealReturnsReal: UnaryOperatorDescriptor = {
    operandType: Types.Real,
    returnType: Types.Real
}

const BooleanReturnsBoolean: UnaryOperatorDescriptor = {
    operandType: Types.Boolean,
    returnType: Types.Boolean
}

const ReversedUnaryOperators: Map<UnaryOperatorDescriptor, UnaryOperator[]> = new Map<UnaryOperatorDescriptor, UnaryOperator[]>();
ReversedUnaryOperators.set(IntegerReturnsInteger, ['+', '-']);
ReversedUnaryOperators.set(RealReturnsReal, ['+', '-']);
ReversedUnaryOperators.set(BooleanReturnsBoolean, ['NOT']);

const unaries = [...ReversedUnaryOperators.entries()].flatMap(([descr, operators]) => {
    return operators.map(op => [op, descr] as const);
});

export type UnaryOperatorTable = Record<UnaryOperator, UnaryOperatorDescriptor[]>;

function emptUnaryTable(): UnaryOperatorTable {
    const result: any = {};
    const indices: UnaryOperator[] = ["+", "-", "NOT"];
    indices.forEach(op => result[op] = []);
    return result as UnaryOperatorTable;
}

export const UnaryOperators = Object.entries(_.groupBy(unaries, ([op]) => op))
    .reduce((lhs, rhs) => {
        const key: UnaryOperator = rhs[0] as UnaryOperator;
        lhs[key] = lhs[key].concat(rhs[1].map(descr => descr[1]));
        return lhs;
    }, emptUnaryTable());

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

const CharCharReturnsChar: BinaryOperatorDescriptor = {
    left: Types.Char(),
    right: Types.Char(),
    returnType: Types.Char()
}

const CharCharReturnsReal: BinaryOperatorDescriptor = {
    left: Types.Char(),
    right: Types.Char(),
    returnType: Types.Real
}

const ReversedBinaryOperators: Map<BinaryOperatorDescriptor, BinaryOperator[]> = new Map<BinaryOperatorDescriptor, BinaryOperator[]>();
ReversedBinaryOperators.set(IntegerIntegerReturnsInteger, ["%", "*", "+", "-", "/"]);
ReversedBinaryOperators.set(RealRealReturnsReal, ["%", "*", "+", "-", "/"]);
ReversedBinaryOperators.set(IntegerIntegerReturnsBoolean, ["<", "<=", "<>", "=", ">", ">="]);
ReversedBinaryOperators.set(RealRealReturnsBoolean, ["<", "<=", "<>", "=", ">", ">="]);
ReversedBinaryOperators.set(CharCharReturnsBoolean, ["<", "<=", "<>", "=", ">", ">=", "LIKE"]);
ReversedBinaryOperators.set(BooleanBooleanReturnsBoolean, ["<", "<=", "<>", "=", ">", ">=", "AND", "OR"]);
ReversedBinaryOperators.set(CharCharReturnsChar, ['||', 'LIKE', '::$', '::']);
ReversedBinaryOperators.set(CharCharReturnsReal, ['::%']);

const flatMap = [...ReversedBinaryOperators.entries()].flatMap(([descr, operators]) => {
    return operators.map(op => [op, descr] as const);
});

export type BinaryOperatorTable = Record<BinaryOperator, BinaryOperatorDescriptor[]>;

function emptyBinaryTable(): BinaryOperatorTable {
    const result: any = {};
    const indices: BinaryOperator[] = ["%", "*", "+", "-", "/", "<", "<=", "<>", "=", ">", ">=", "AND", "OR", "||", "IS", "LIKE", "IN", "::", "::$", "::%"];
    indices.forEach(op => result[op] = []);
    return result as BinaryOperatorTable;
}

export const BinaryOperators = Object.entries(_.groupBy(flatMap, ([op]) => op))
    .reduce((lhs, rhs) => {
        const key: BinaryOperator = rhs[0] as BinaryOperator;
        lhs[key] = lhs[key].concat(rhs[1].map(descr => descr[1]));
        return lhs;
    }, emptyBinaryTable());

