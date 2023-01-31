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
} from "./generated/ast";
import { canConvert } from "./sql-type-conversion";
import { ColumnTypeDescriptor, RowTypeDescriptor, TypeDescriptor, Types } from "./sql-type-descriptors";
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
    } else if(isType(node)) {
        return getTypeOfDataType(node);
    }
    return undefined;
}

function computeTypeOfExpression(node: Expression): TypeDescriptor | undefined {
    if (isCastExpression(node)) {
        const source = computeType(node.expr);
        const target = getTypeOfDataType(node.type);
        return source && target && canConvert(source, target, 'explicit') ? target : undefined;
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
    if(isSubQueryExpression(node)) {
        return computeTypeOfSelectStatement(node.subQuery);
    }
    assertUnreachable(node);
}

export function computeTypeOfSelectStatement(selectStatement: SelectStatement): RowTypeDescriptor {
    const columnTypes = selectStatement.select.elements.map(e => {
        if(isAllStar(e)) {
            assert(selectStatement.from != null);
            const rows = selectStatement.from.sources.list.map(src => getTypesOfTableSources(src));
            return {
                discriminator: 'row',
                columnTypes: rows.flatMap(t => t.columnTypes)
            };
        } else if(isAllTable(e)) {
            assert(selectStatement.from != null);
            const columns = e.variableName.variable.ref?.tableName.table.ref?.columns ?? [];
            return {
                discriminator: 'row',
                columnTypes: columns.map<ColumnTypeDescriptor>(c => ({name: c.name, type: computeType(c.dataType)!}))
            };
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

function getTypesOfTableSources(source: TableSource): RowTypeDescriptor {
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

