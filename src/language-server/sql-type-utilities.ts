/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode } from "langium";
import { Expression, isAllStar, isAllTable, isColumnName, isExpressionQuery, isFunctionCall, isSubQuerySourceItem, isTableSourceItem, SelectStatement, TableSource } from "./generated/ast";

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
            if(!selectStatement.from) {
                return [];
            }
            const fromAllSources = selectStatement.from.sources.list.map(getColumnsForTableSource);
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
            return [{
                name: e.name ?? getNameForExpression(e.expr), 
                typedNode: e.expr,
                node: e,
                isScopedByVariable: false
            }];
        }
        assertUnreachable(e);
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

function getNameForExpression(expr: Expression): string | undefined {
    if(isFunctionCall(expr)) {
        return expr.functionName.function.$refText;
    } else if(isColumnName(expr)) {
        return expr.column.$refText;
    } else {
        return undefined;
    }
}
