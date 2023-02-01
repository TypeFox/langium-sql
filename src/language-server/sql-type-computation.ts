/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import assert from "assert";
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
    isSubQueryExpression,
    SelectStatement,
    isAllStar,
    isAllTable,
    isExpressionQuery,
    TableSource,
    isTableSourceItem,
    isSubQuerySourceItem,
    isType,
    isColumnDefinition,
} from "./generated/ast";
import { canConvert } from "./sql-type-conversion";
import { areTypesEqual, ColumnTypeDescriptor, RowTypeDescriptor, TypeDescriptor, Types } from "./sql-type-descriptors";
import { BinaryOperator, BinaryOperators, UnaryOperator, UnaryOperators } from "./sql-type-operators";
import {
    assertUnreachable,
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
    if (isColumnName(node)) {
        const ref = node.column.ref;
        if(!ref) {
            return undefined;
        } else if(isExpressionQuery(ref)) {
            return computeType(ref.expr);
        } else if(isColumnDefinition(ref)) {
            return computeType(ref.dataType);
        } else {
            assertUnreachable(ref);
            return undefined;
        }
    }
    if (isFunctionCall(node)) {
        const dataType = node.functionName.function.ref?.returnType;
        return dataType ? computeTypeOfDataType(dataType) : undefined;
    }
    if (isBinaryExpression(node)) {
        const left = computeType(node.left);
        const right = computeType(node.right);
        if (left && right) {
            return computeTypeOfBinaryOperation(node.operator, left, right);
        }
        return undefined;
    }
    if(isSubQueryExpression(node)) {
        return computeTypeOfSelectStatement(node.subQuery);
    }
    assertUnreachable(node);
}

export function computeTypeOfSelectStatement(selectStatement: SelectStatement): RowTypeDescriptor {
    const columnTypes = selectStatement.select.elements.map(e => {
        if(isAllStar(e)) {
            assert(selectStatement.from != null);
            const rows = selectStatement.from.sources.list.map(src => computeColumnTypesOfTableSource(src));
            return {
                discriminator: 'row',
                columnTypes: rows.flatMap(t => t.columnTypes)
            };
        } else if(isAllTable(e)) {
            assert(selectStatement.from != null);
            const ref = e.variableName.variable.ref!;
            if(isTableSourceItem(ref)) {
                const columns = ref.tableName.table.ref?.columns ?? [];
                return {
                    discriminator: 'row',
                    columnTypes: columns.map<ColumnTypeDescriptor>(c => ({name: c.name, type: computeType(c.dataType)!}))
                };    
            } else if(isSubQuerySourceItem(ref)) {
                return computeTypeOfSelectStatement(ref.subQuery);
            } else {
                assertUnreachable(ref);
            }
        } else if(isExpressionQuery(e)) {
            return {
                discriminator: 'row',
                columnTypes: [{name: undefined, type: computeType(e.expr)!}]
            };
        }
        assertUnreachable(e);
        return undefined!;
    });
    return {
        discriminator: 'row',
        columnTypes: columnTypes.flatMap(c=> c.columnTypes)
    }
}

function computeColumnTypesOfTableSource(source: TableSource): RowTypeDescriptor {
    const result: RowTypeDescriptor = {discriminator: 'row', columnTypes: []};
    const items = [source.item].concat(source.joins.map(j => j.nextItem));
    for (const item of items) {
        if(isTableSourceItem(item)) {
            if(item.tableName.table.ref) {
                for (const column of item.tableName.table.ref!.columns) {
                    result.columnTypes.push({
                        name: column.name,
                        type: computeType(column.dataType)!
                    })
                }
            }
        } else if(isSubQuerySourceItem(item)) {
            const rowType = computeTypeOfSelectStatement(item.subQuery);
            for (const columnType of rowType.columnTypes) {
                result.columnTypes.push(columnType);
            }
        } else {
            assertUnreachable(item);
        }
    }
    return result;
}

function computeTypeOfDataType(dataType: Type): TypeDescriptor | undefined {
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