/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import _ from "lodash";
import { UnaryExpression } from "./generated/ast";
import { areTypesEqual, TypeDescriptor, Types } from "./sql-type-descriptors";
import { BinaryOperator, BinaryOperators, UnaryOperators } from "./sql-type-operators";

const NumericLiteralPattern = /^(\d+)((\.(\d)+)?([eE]([\-+]?\d+))?)?$/;
export function computeTypeOfNumericLiteral(
    text: string
): TypeDescriptor | undefined {
    //TODO implement it properly, maybe with notes from here: https://crate.io/docs/sql-99/en/latest//chapters/03.html#choosing-the-right-data-type
    const match = NumericLiteralPattern.exec(text)!;
    const fractionalPart = match[4]?.length ?? 0;
    const exponent = parseInt(match[6] ?? "0", 10);
    return Math.max(0, fractionalPart - exponent) === 0 ? Types.Integer : Types.Real;
}

export function assertUnreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}

export function computeTypeOfBinaryOperation(
    operator: BinaryOperator,
    left: TypeDescriptor,
    right: TypeDescriptor
): TypeDescriptor | undefined {
    const candidates = BinaryOperators[operator];
    for (const candidate of candidates) {
        if(areTypesEqual(candidate.left, left) && areTypesEqual(candidate.right, right)) {
            return candidate.returnType;
        }
    }
    return undefined;
}

export function computeTypeOfUnaryOperation(
    operator: UnaryExpression["operator"],
    operandType: TypeDescriptor
): TypeDescriptor | undefined {
    const candidates = UnaryOperators[operator];
    for (const candidate of candidates) {
        if(areTypesEqual(candidate.operandType, operandType)) {
            return candidate.returnType;
        }
    }
    return undefined;
}
