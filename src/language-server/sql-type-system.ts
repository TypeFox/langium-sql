/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode } from "langium";
import _ from "lodash";
import {
    Expression,
    isBooleanType,
    isCastExpression,
    isColumnName,
    isExpression,
    isIntegerType,
    isRealType,
    Type,
    isTableRelatedColumnExpression,
    isBinaryExpression,
    isUnaryExpression,
    isParenthesisExpression,
    isCharType,
    isNumberLiteral,
    isStringLiteral,
    isBooleanLiteral,
    isFunctionCall,
} from "./generated/ast";
import { TypeDescriptor, Types } from "./sql-type-descriptors";
import {
    assertUnreachable,
    computeTypeOfBinaryOperation,
    computeTypeOfNumericLiteral,
    computeTypeOfUnaryOperation,
} from "./sql-type-utilities";

export type ComputeTypeFunction = (node: AstNode) => TypeDescriptor | undefined;

export function computeType(node: AstNode): TypeDescriptor | undefined {
    if (isExpression(node)) {
        return computeTypeOfExpression(node);
    }
    return undefined;
}

function computeTypeOfExpression(node: Expression): TypeDescriptor | undefined {
    if (isCastExpression(node)) {
        return getTypeOfDataType(node.type);
    }
    if (isNumberLiteral(node)) {
        return computeTypeOfNumericLiteral(node.$cstNode!.text);
    }
    if (isTableRelatedColumnExpression(node)) {
        const dataType = node.columnName.column.ref?.dataType;
        return dataType ? getTypeOfDataType(dataType) : undefined;
    }
    if (isParenthesisExpression(node)) {
        return computeType(node.expression);
    }
    if (isUnaryExpression(node)) {
        const operandType = computeType(node.value);
        return operandType != null
            ? computeTypeOfUnaryOperation(node.operator, operandType)
            : undefined;
    }
    if (isStringLiteral(node)) {
        return Types.Char();
    }
    if (isBooleanLiteral(node)) {
        return Types.Boolean;
    }
    if (isColumnName(node)) {
        const dataType = node.column.ref?.dataType;
        return dataType != null ? getTypeOfDataType(dataType) : undefined;
    }
    if (isFunctionCall(node)) {
        const dataType = node.functionName.function.ref?.returnType;
        return dataType ? getTypeOfDataType(dataType) : undefined;
    }
    if (isBinaryExpression(node)) {
        const left = computeType(node.left);
        const right = computeType(node.right);
        if (left && right) {
            return computeTypeOfBinaryOperation(node.operator, left, right);
        }
        return undefined;
    }
    assertUnreachable(node);
}

function getTypeOfDataType(dataType: Type): TypeDescriptor | undefined {
    if (isBooleanType(dataType)) {
        return Types.Boolean;
    }
    if (isIntegerType(dataType)) {
        return Types.Integer;
    }
    if (isRealType(dataType)) {
        return Types.Real;
    }
    if (isCharType(dataType)) {
        return Types.Char(dataType.length?.value);
    }
    assertUnreachable(dataType);
}
