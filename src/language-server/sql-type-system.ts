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
    isNumericExpression,
    isTableRelatedColumnExpression,
    isBinaryExpression,
    isUnaryExpression,
    isParenthesisExpression,
    isCharType,
} from "./generated/ast";
import { TypeDescriptor, Types } from "./sql-type-descriptors";
import {
    assertUnreachable,
    computeTypeOfBinaryOperation,
    computeTypeOfNumericLiteral,
    computeTypeOfUnaryOperation,
} from "./sql-type-utilities";

export type ComputeTypeFunction = (node: AstNode) => TypeDescriptor | undefined;
export const createCachedComputeType = function (): ComputeTypeFunction {
    return _.memoize(computeType);

    function computeType(node: AstNode): TypeDescriptor | undefined {
        if (isExpression(node)) {
            return computeTypeOfExpression(node);
        }
        return undefined;
    }

    function computeTypeOfExpression(
        node: Expression
    ): TypeDescriptor | undefined {
        if (isCastExpression(node)) {
            return getTypeOfDataType(node.type);
        }
        if (isNumericExpression(node)) {
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
            return operandType
                ? computeTypeOfUnaryOperation(node.operator, operandType)
                : undefined;
        }
        if (isColumnName(node)) {
            const dataType = node.column.ref?.dataType;
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
        if(isCharType(dataType)) {
            return Types.Char(dataType.length?.value);
        }
        assertUnreachable(dataType);
    }
};
