/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode } from "langium";
import { isAllStar, isAllTable, isColumnDefinition, isColumnNameExpression, isExpressionQuery, isFunctionCall, isSubQuerySourceItem, isTableRelatedColumnExpression, isTableSourceItem, SelectStatement, TableSource } from "./generated/ast";

export function assertUnreachable(x: never): never {
    throw new Error("Didn't expect to get here");
}

export interface ColumnDescriptor {
    name?: string;
    node: AstNode;
    typedNode: AstNode;
    isScopedByVariable: boolean;
}

export function getColumnsForSelectStatement(selectStatement: SelectStatement): ColumnDescriptor[] {
    return selectStatement.select.elements.flatMap(e => {
        if(isAllStar(e)) {
            const fromAllSources = selectStatement.from?.sources.list.flatMap(getColumnsForTableSource) ?? [];
            return fromAllSources.flatMap(t => t);
        } else if(isAllTable(e)) {
            if(!selectStatement.from) {
                return [];
            }
            const ref = e.variableName.variable.ref!;
            if(isTableSourceItem(ref)) {
                const columns = ref.tableName.table.ref?.columns ?? [];
                return columns.map<ColumnDescriptor>(c => ({
                    name: c.name,
                    typedNode: c.dataType,
                    node: c,
                    isScopedByVariable: true
                }));
            } else if(isSubQuerySourceItem(ref)) {
                return getColumnsForSelectStatement(ref.subQuery);
            } else {
                assertUnreachable(ref);
            }
        } else if(isExpressionQuery(e)) {
            if(e.name) {
                return [{
                    name: e.name!, 
                    typedNode: e.expr as AstNode,
                    node: e as AstNode,
                    isScopedByVariable: false
                }];
            } else {
                const expr = e.expr;
                if(isTableRelatedColumnExpression(expr)) {
                    return [{
                        name: expr.columnName.column.$refText,
                        node: e as AstNode,
                        isScopedByVariable: true,
                        typedNode: expr.columnName.column.ref as AstNode
                    }];
                } else if(isFunctionCall(expr)) {
                    return [{
                        name: expr.functionName.function.$refText,
                        isScopedByVariable: false,
                        node: e as AstNode,
                        typedNode: expr.functionName.function.ref!.returnType as AstNode
                     }];
                } else if(isColumnNameExpression(expr)) {
                    const fromAllSources = selectStatement.from?.sources.list.flatMap(getColumnsForTableSource) ?? [];
                    return fromAllSources.filter(s => !s.isScopedByVariable).map(s => s);
                } else {
                    return [{
                        name: undefined,
                        isScopedByVariable: false,
                        node: e,
                        typedNode: e.expr
                    }]
                }
            }
        }
        return [];
    });
}

function getColumnsForTableSource(source: TableSource): ColumnDescriptor[] {
    const items = [source.item].concat(source.joins.map(j => j.nextItem));
    return items.flatMap(item => {
        if(isTableSourceItem(item)) {
            if(item.tableName.table.ref) {
                return item.tableName.table.ref.columns.map(column => ({
                    name: column.name,
                    typedNode: column.dataType,
                    node: column,
                    isScopedByVariable: item.name != null
                }));
            }
            return [];
        } else if(isSubQuerySourceItem(item)) {
            return getColumnsForSelectStatement(item.subQuery);
        } else {
            assertUnreachable(item);
            return [];
        }
    });
}

