/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode, Reference, assertUnreachable } from "langium";
import { ColumnNameSource, isAllStar, isAllTable, isBinaryTableExpression, isColumnDefinition, isColumnNameExpression, isCommonTableExpression, isExpressionQuery, isFunctionCall, isParenthesesSelectTableExpression, isSelectTableExpression, isSimpleSelectTableExpression, isSubQueryExpression, isSubQuerySourceItem, isTableDefinition, isTableRelatedColumnExpression, isTableSourceItem, SelectTableExpression, SimpleSelectStatement, TableSource } from "./generated/ast";

export interface ColumnDescriptor {
    name?: string;
    node: AstNode;
    typedNode: AstNode;
    isScopedByVariable: boolean;
}

export function getColumnsForSelectTableExpression(selectTableExpression: SelectTableExpression, onlyAliases: boolean = false): ColumnDescriptor[] {
    if(isBinaryTableExpression(selectTableExpression)) {
        const lhs = getColumnsForSelectTableExpression(selectTableExpression.left, onlyAliases);
        //const rhs = getColumnsForSelectTableExpression(selectTableExpression.right, onlyAliases);
        return lhs;
    } else if(isParenthesesSelectTableExpression(selectTableExpression)) {
        return getColumnsForSelectTableExpression(selectTableExpression.value);
    } else if(isSimpleSelectTableExpression(selectTableExpression)) {
        return getColumnsSimpleSelectStatement(selectTableExpression.select, onlyAliases);
    } else {
        assertUnreachable(selectTableExpression);
    }
    return [];
}

function getColumnsSimpleSelectStatement(simpleSelectStatement: SimpleSelectStatement, onlyAliases: boolean): ColumnDescriptor[] {
    return simpleSelectStatement.select.elements.flatMap(e => {
        if(isAllStar(e)) {
            if(onlyAliases) {
                return [];
            }
            const fromAllSources = getColumnCandidatesForSimpleSelectStatement(simpleSelectStatement);
            return fromAllSources.flatMap(t => t);
        } else if(isAllTable(e)) {
            if(onlyAliases) {
                return [];
            }
            if(!simpleSelectStatement.from) {
                return [];
            }
            const ref = e.variableName.ref!;
            if(isTableSourceItem(ref)) {
                const tableLike = ref.tableName.ref!;
                if(isTableDefinition(tableLike)) {
                    const columns = tableLike.columns.filter(isColumnDefinition) ?? [];
                    return columns.map<ColumnDescriptor>(c => ({
                        name: c.name,
                        typedNode: c.dataType,
                        node: c,
                        isScopedByVariable: true
                    }));
                } else if(isCommonTableExpression(tableLike)) {
                    const columns = getColumnsForSelectTableExpression(tableLike.statement);
                    if(tableLike.columnNames.length > 0) {
                        return columns.map((c, i) => ({
                            ...c,
                            name: tableLike.columnNames[i].name
                        }));
                    }
                    return columns;
                } else {
                    assertUnreachable(tableLike);
                }
            } else if(isSubQuerySourceItem(ref)) {
                return getColumnsForSelectTableExpression(ref.subQuery);
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
                if(onlyAliases) {
                    return [];
                }
                const expr = e.expr;
                if(isTableRelatedColumnExpression(expr)) {
                    return resolveColumnNameTypedNode(e, expr.columnName);
                } else if(isFunctionCall(expr)) {
                    const functionLike = expr.functionName.ref!;
                    return [{
                        name: expr.functionName.$refText,
                        isScopedByVariable: false,
                        node: e as AstNode,
                        typedNode: functionLike.returnType
                     }];
                } else if(isColumnNameExpression(expr)) {
                    const fromAllSources = getColumnCandidatesForSimpleSelectStatement(simpleSelectStatement);
                    const name = expr.columnName.$refText;
                    const column = fromAllSources.find(s => !s.isScopedByVariable && s.name === name)
                    if(column) {
                        return [column];
                    } else {
                        return resolveColumnNameTypedNode(expr, expr.columnName);
                    }
                } else if(isSubQueryExpression(expr)) {
                    const columns = getColumnsForSelectTableExpression(expr.subQuery);
                    return [columns[0]]
                } else {
                    return [{
                        node: e,
                        typedNode: e.expr,
                        isScopedByVariable: false
                    }]
                }
            }
        } else {
            assertUnreachable(e);
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


export function getColumnCandidatesForSelectTableExpression(selectTableExpression: SelectTableExpression): ColumnDescriptor[] {
    if(isBinaryTableExpression(selectTableExpression)) {
        const lhs = getColumnCandidatesForSelectTableExpression(selectTableExpression.left);
        //const rhs = getColumnCandidatesForSelectTableExpression(selectTableExpression.right);
        return lhs;
    } else if(isParenthesesSelectTableExpression(selectTableExpression)) {
        return getColumnCandidatesForSelectTableExpression(selectTableExpression.value);
    } else if(isSimpleSelectTableExpression(selectTableExpression)) {
        return getColumnCandidatesForSimpleSelectStatement(selectTableExpression.select);
    } else {
        assertUnreachable(selectTableExpression);
    }
    return [];
}

export function getColumnCandidatesForSimpleSelectStatement(selectStatement: SimpleSelectStatement) {
    const selectElementColumns = getColumnsSimpleSelectStatement(selectStatement, true);
    const fromComputedColumns = selectStatement.from?.sources.list.flatMap(getColumnsForTableSource) ?? [];
    return selectElementColumns.concat(fromComputedColumns);
}

function getColumnsForTableSource(source: TableSource): ColumnDescriptor[] {
    const items = [source.item].concat(source.joins.map(j => j.nextItem));
    return items.flatMap(item => {
        if(isTableSourceItem(item)) {
            const tableLike = item.tableName.ref;
            if(isTableDefinition(tableLike)) {
                return tableLike.columns.filter(isColumnDefinition).map(column => ({
                    name: column.name,
                    typedNode: column.dataType,
                    node: column,
                    isScopedByVariable: item.name != null
                }));
            } else if(isCommonTableExpression(tableLike)) {
                let columns = getColumnsForSelectTableExpression(tableLike.statement);
                if(tableLike.columnNames.length > 0) {
                    columns = columns.map((c, i) => ({...c, name: tableLike.columnNames[i].name}));
                }
                return columns;
            }
            return [];
        } else if(isSubQuerySourceItem(item)) {
            return getColumnsForSelectTableExpression(item.subQuery);
        } else {
            assertUnreachable(item);
            return [];
        }
    });
}

