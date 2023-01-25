/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import _ from "lodash";
import { BinaryExpression, UnaryExpression } from "./generated/ast";
import { isTypeABoolean, isTypeANumber, isTypeAReal, TypeDescriptor, Types } from "./sql-type-descriptors";

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
    operator: BinaryExpression["operator"],
    left: TypeDescriptor,
    right: TypeDescriptor
): TypeDescriptor | undefined {
    switch (operator) {
        case "+":
        case "-":
        case "/":
        case "*":
        case "%":
            if (isTypeANumber(left) && isTypeANumber(right)) {
                if(isTypeAReal(left) || isTypeAReal(right)) {
                    return Types.Real;
                }
                return Types.Integer;
            }
            break;
        case "<":
        case "<=":
        case ">":
        case ">=":
        case "<>":
        case "=":
            if (isTypeABoolean(left) && isTypeABoolean(right)) {
                return Types.Boolean;
            }
            if (isTypeANumber(left) && isTypeANumber(right)) {
                return Types.Boolean;
            }
            return undefined;
        case "AND":
        case "OR":
            if (isTypeABoolean(left) && isTypeABoolean(right)) {
                return Types.Boolean;
            }
            return undefined;
        default:
            assertUnreachable(operator);
    }
    return undefined;
}

export function computeTypeOfUnaryOperation(
    operator: UnaryExpression["operator"],
    operandType: TypeDescriptor
): TypeDescriptor | undefined {
    switch(operator) {
        case '+':
        case '-':
            if(isTypeANumber(operandType)) {
                return operandType;
            }
            break;
        case 'NOT':
            if(isTypeABoolean(operandType)) {
                return operandType;
            }
            break;
    }
    return undefined;
}
