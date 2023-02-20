/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode, Reference } from "langium";
import { ColumnNameSource, isAllStar, isAllTable, isColumnDefinition, isColumnNameExpression, isExpressionQuery, isFunctionCall, isSubQueryExpression, isSubQuerySourceItem, isTableRelatedColumnExpression, isTableSourceItem, SelectStatement, TableSource } from "./generated/ast";

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
            const fromAllSources = getColumnCandidatesForSelectStatement(selectStatement);
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
                    return resolveColumnNameTypedNode(e, expr.columnName.column);
                } else if(isFunctionCall(expr)) {
                    return [{
                        name: expr.functionName.function.$refText,
                        isScopedByVariable: false,
                        node: e as AstNode,
                        typedNode: expr.functionName.function.ref!.returnType as AstNode
                     }];
                } else if(isColumnNameExpression(expr)) {
                    const fromAllSources = getColumnCandidatesForSelectStatement(selectStatement);
                    const name = expr.columnName.column.$refText;
                    const column = fromAllSources.find(s => !s.isScopedByVariable && s.name === name)
                    if(column) {
                        return [column];
                    } else {
                        return resolveColumnNameTypedNode(expr, expr.columnName.column);
                    }
                } else if(isSubQueryExpression(expr)) {
                    const columns = getColumnsForSelectStatement(expr.subQuery);
                    return [columns[0]]
                } else {
                    return [{
                        node: e,
                        typedNode: e.expr,
                        isScopedByVariable: false
                    }]
                }
            }
        }
        return [];
    });
}

function resolveColumnNameTypedNode(expression: AstNode, columnName: Reference<ColumnNameSource>) {
    const ref = columnName.ref;
    let typed: AstNode = expression;
    if (isExpressionQuery(ref)) {
        typed = ref.expr;
    } else if (isColumnDefinition(ref)) {
        typed = ref.dataType;
    }
    return [{
        name: ref?.name,
        isScopedByVariable: false,
        node: expression,
        typedNode: typed
    }];
}

export function getColumnCandidatesForSelectStatement(selectStatement: SelectStatement) {
    return selectStatement.from?.sources.list.flatMap(getColumnsForTableSource) ?? [];
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

