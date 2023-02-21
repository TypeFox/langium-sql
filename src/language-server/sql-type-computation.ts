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
    isSubQueryExpression,
    SelectStatement,
    isExpressionQuery,
    isTableSourceItem,
    isSubQuerySourceItem,
    isType,
    isColumnDefinition,
    isColumnNameExpression,
    isEnumType,
    isDateTimeType,
    isCteColumnName,
    isFunctionDefinition,
    isNegatableExpression,
    isBetweenExpression,
} from "./generated/ast";
import { canConvert } from "./sql-type-conversion";
import { areTypesEqual, RowTypeDescriptor, TypeDescriptor, Types } from "./sql-type-descriptors";
import { BinaryOperator, BinaryOperators, UnaryOperator, UnaryOperators } from "./sql-type-operators";
import {
    assertUnreachable, getColumnsForSelectStatement,
} from "./sql-type-utilities";

export type ComputeTypeFunction = (node: AstNode) => TypeDescriptor | undefined;

export function computeType(node: AstNode): TypeDescriptor | undefined {
    if (isExpression(node)) {
        return computeTypeOfExpression(node);
    } else if(isType(node)) {
        return computeTypeOfDataType(node);
    }
    return undefined;
}

function computeTypeOfExpression(node: Expression): TypeDescriptor | undefined {
    if (isCastExpression(node)) {
        const source = computeType(node.expr);
        const target = computeTypeOfDataType(node.type);
        return source && target && canConvert(source, target, 'explicit') ? target : undefined;
    }
    if (isNumberLiteral(node)) {
        return computeTypeOfNumericLiteral(node.$cstNode!.text);
    }
    if (isTableRelatedColumnExpression(node)) { //variable.columnName
        const varRef = node.variableName.variable.ref;
        if(!varRef) {
            return undefined;
        } else if(isTableSourceItem(varRef)) { //tableVariable.columnName
            const ref = node.columnName.column.ref;
            if(!isColumnDefinition(ref)) {
                return undefined;
            }
            return computeType(ref.dataType);
        } else if(isSubQuerySourceItem(varRef)) {//subqueryVariable.selectItemName
            const ref = node.columnName.column.ref;
            if(!isExpressionQuery(ref)) {
                return undefined;
            }
            return computeType(ref.expr);
        } else {
            assertUnreachable(varRef);
            return undefined;
        }
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
    if (isColumnNameExpression(node)) {
        const ref = node.columnName.column.ref;
        if(!ref) {
            return undefined;
        } else if(isExpressionQuery(ref)) {
            return computeType(ref.expr);
        } else if(isColumnDefinition(ref)) {
            return computeType(ref.dataType);
        } else if(isCteColumnName(ref)) {
            throw new Error('TODO')
        } else {
            assertUnreachable(ref);
            return undefined;
        }
    }
    if (isFunctionCall(node)) {
        const functionLike = node.functionName.function.ref!;
        if(isFunctionDefinition(functionLike)) {
            return computeTypeOfDataType(functionLike.returnType);
        } else {
            assertUnreachable(functionLike);
        }
    }
    if (isBinaryExpression(node) || isNegatableExpression(node)) {
        const left = computeType(node.left);
        const right = computeType(node.right);
        if (left && right) {
            return computeTypeOfBinaryOperation(node.operator, left, right);
        }
        return undefined;
    }
    if(isBetweenExpression(node)) {
        return Types.Boolean;
    }
    if(isSubQueryExpression(node)) {
        return computeTypeOfSelectStatement(node.subQuery);
    }
    assertUnreachable(node);
}

export function computeTypeOfSelectStatement(selectStatement: SelectStatement): RowTypeDescriptor {
    return {
        discriminator: "row",
        columnTypes: getColumnsForSelectStatement(selectStatement).map(c => ({
            name: c.name,
            type: computeType(c.typedNode)!
        }))
    };
}

export function computeTypeOfDataType(dataType: Type): TypeDescriptor | undefined {
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
    if(isEnumType(dataType)) {
        return Types.Enum(dataType.members);
    }
    if(isDateTimeType(dataType)) {
        return Types.DateTime;
    }
    assertUnreachable(dataType);
}

const NumericLiteralPattern = /^(\d+)((\.(\d)+)?([eE]([\-+]?\d+))?)?$/;
export function computeTypeOfNumericLiteral(
    text: string
): TypeDescriptor | undefined {
    const match = NumericLiteralPattern.exec(text)!;
    const fractionalPart = match[4]?.length ?? 0;
    const exponent = parseInt(match[6] ?? "0", 10);
    return Math.max(0, fractionalPart - exponent) === 0 ? Types.Integer : Types.Real;
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
        } else {
            if(canConvert(left, candidate.left, 'implicit') && canConvert(right, candidate.right, 'implicit')) {
                return candidate.returnType;
            }
        }
    }
    return undefined;
}

export function computeTypeOfUnaryOperation(
    operator: UnaryOperator,
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