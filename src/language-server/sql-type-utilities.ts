/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import _ from "lodash";
import { BinaryExpression, UnaryExpression } from "./generated/ast";
import { isTypeANumber, TypeDescriptor } from "./sql-type-descriptors";

const NumericLiteralPattern = /^(\d+)((\.(\d)+)?([eE]([\-+]?\d+))?)?$/;
export function computeTypeOfNumericLiteral(
    text: string
): TypeDescriptor | undefined {
    //TODO implement it properly, maybe with notes from here: https://crate.io/docs/sql-99/en/latest//chapters/03.html#choosing-the-right-data-type
    const match = NumericLiteralPattern.exec(text)!;
    const integerPart = match[1].length;
    const fractionalPart = match[4]?.length ?? 0;
    const exponent = parseInt(match[6] ?? "0", 10);
    return {
        discriminator: "numeric",
        precision: Math.max(0, integerPart + exponent),
        scale: Math.max(0, fractionalPart - exponent),
    };
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
                //TODO find a proper way
                if (_.isEqual(left, right)) {
                    return left;
                }
                return undefined;
            }
            break;
        case "<":
        case "<=":
        case ">":
        case ">=":
        case "<>":
        case "=":
        case "AND":
        case "OR":
            //TODO add proper checks for type compatibility
            return {
                discriminator: "boolean",
            };
        default:
            assertUnreachable(operator);
    }
    return undefined;
}

export function computeTypeOfUnaryOperation(
    operator: UnaryExpression["operator"],
    operandType: TypeDescriptor
): TypeDescriptor | undefined {
    //TODO do it properly
    return undefined;
}
