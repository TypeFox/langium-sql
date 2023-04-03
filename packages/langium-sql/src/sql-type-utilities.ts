/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, Reference, assertUnreachable } from "langium";
import * as AST from "./generated/ast";

export interface ColumnDescriptor {
    name?: string;
    node: AstNode;
    typedNode: AstNode;
    isScopedByVariable: boolean;
}

export function getFromGlobalReference<T extends AST.Definition>(reference: AST.GlobalReference | undefined, is: (definition: AST.Definition) => definition is T): T | undefined {
    const element = reference?.element?.ref;
    if (element && is(element)) {
        return element;
    } else {
        return undefined;
    }
}

export function getDefinitionType(element: AST.Definition): DefinitionType {
    if (AST.isCatalogDefinition(element)) {
        return DefinitionType.Catalog;
    } else if (AST.isSchemaDefinition(element)) {
        return DefinitionType.Schema;
    } else {
        return DefinitionType.Table;
    }
}

export function getDefinitionTypeName(element: AST.Definition): string {
    if (AST.isCatalogDefinition(element)) {
        return 'DATABASE';
    } else if (AST.isSchemaDefinition(element)) {
        return 'SCHEMA';
    } else if (AST.isTableLike(element)) {
        return 'TABLE';
    } else if (AST.isFunctionDefinition(element)) {
        return 'FUNCTION'
    } else {
        return 'UNKNOWN';
    }
}

export enum DefinitionType {
    Catalog = 0,
    Schema = 1,
    Table = 2
}

export function getColumnsForSelectTableExpression(selectTableExpression: AST.SelectTableExpression | undefined, onlyAliases: boolean = false): ColumnDescriptor[] {
    if (AST.isBinaryTableExpression(selectTableExpression)) {
        const lhs = getColumnsForSelectTableExpression(selectTableExpression.left, onlyAliases);
        //const rhs = getColumnsForSelectTableExpression(selectTableExpression.right, onlyAliases);
        return lhs;
    } else if (AST.isParenthesesSelectTableExpression(selectTableExpression)) {
        return getColumnsForSelectTableExpression(selectTableExpression.value);
    } else if (AST.isSimpleSelectTableExpression(selectTableExpression)) {
        return getColumnsSimpleSelectStatement(selectTableExpression.select, onlyAliases);
    } else if (!selectTableExpression) {
        return [];
    } else {
        assertUnreachable(selectTableExpression);
    }
}

function getColumnsSimpleSelectStatement(simpleSelectStatement: AST.SimpleSelectStatement | undefined, onlyAliases: boolean): ColumnDescriptor[] {
    if (!simpleSelectStatement || !simpleSelectStatement.select) {
        return [];
    }
    return simpleSelectStatement.select.elements.flatMap(e => {
        if (AST.isAllStar(e)) {
            if (onlyAliases) {
                return [];
            }
            const fromAllSources = getColumnCandidatesForSimpleSelectStatement(simpleSelectStatement);
            return fromAllSources.flatMap(t => t);
        } else if (AST.isAllTable(e)) {
            if (onlyAliases) {
                return [];
            }
            if (!simpleSelectStatement.from) {
                return [];
            }
            const ref = e.variableName.ref!;
            if (AST.isTableSourceItem(ref)) {
                const tableLike = getFromGlobalReference(ref.table, AST.isTableLike);
                if (AST.isTableDefinition(tableLike)) {
                    const columns = tableLike.columns.filter(AST.isColumnDefinition) ?? [];
                    return columns.map<ColumnDescriptor>(c => ({
                        name: c.name,
                        typedNode: c.dataType,
                        node: c,
                        isScopedByVariable: true
                    }));
                } else if (AST.isCommonTableExpression(tableLike)) {
                    const columns = getColumnsForSelectTableExpression(tableLike.statement);
                    if (tableLike.columnNames.length > 0) {
                        return columns.map((c, i) => ({
                            ...c,
                            name: tableLike.columnNames[i].name
                        }));
                    }
                    return columns;
                } else if (tableLike) {
                    assertUnreachable(tableLike);
                }
            } else if (AST.isSubQuerySourceItem(ref)) {
                return getColumnsForSelectTableExpression(ref.subQuery);
            } else {
                assertUnreachable(ref);
            }
        } else if (AST.isExpressionQuery(e)) {
            if (e.name) {
                return [{
                    name: e.name!,
                    typedNode: e.expr as AstNode,
                    node: e as AstNode,
                    isScopedByVariable: false
                }];
            } else {
                if (onlyAliases) {
                    return [];
                }
                const expr = e.expr;
                if (AST.isTableRelatedColumnExpression(expr)) {
                    return resolveColumnNameTypedNode(e, expr.columnName);
                } else if (AST.isFunctionCall(expr)) {
                    const functionLike = getFromGlobalReference(expr.function, AST.isFunctionDefinition);
                    if (functionLike) {
                        const name = expr.function.element.$refText;
                        return [{
                            name,
                            isScopedByVariable: false,
                            node: e,
                            typedNode: functionLike.returnType
                        }];
                    } else {
                        return [];
                    }
                } else if (AST.isColumnNameExpression(expr)) {
                    const fromAllSources = getColumnCandidatesForSimpleSelectStatement(simpleSelectStatement);
                    const name = expr.columnName.$refText;
                    const column = fromAllSources.find(s => !s.isScopedByVariable && s.name === name)
                    if (column) {
                        return [column];
                    } else {
                        return resolveColumnNameTypedNode(expr, expr.columnName);
                    }
                } else if (AST.isSubQueryExpression(expr)) {
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

function resolveColumnNameTypedNode(expression: AstNode, columnName: Reference<AST.ColumnNameSource>) {
    const ref = columnName.ref;
    let typed: AstNode = expression;
    if (AST.isExpressionQuery(ref)) {
        typed = ref.expr;
    } else if (AST.isColumnDefinition(ref)) {
        typed = ref.dataType;
    }
    return [{
        name: ref?.name,
        isScopedByVariable: false,
        node: expression,
        typedNode: typed
    }];
}


export function getColumnCandidatesForSelectTableExpression(selectTableExpression?: AST.SelectTableExpression): ColumnDescriptor[] {
    if (AST.isBinaryTableExpression(selectTableExpression)) {
        const lhs = getColumnCandidatesForSelectTableExpression(selectTableExpression.left);
        //const rhs = getColumnCandidatesForSelectTableExpression(selectTableExpression.right);
        return lhs;
    } else if (AST.isParenthesesSelectTableExpression(selectTableExpression)) {
        return getColumnCandidatesForSelectTableExpression(selectTableExpression.value);
    } else if (AST.isSimpleSelectTableExpression(selectTableExpression)) {
        return getColumnCandidatesForSimpleSelectStatement(selectTableExpression.select);
    } else if (!selectTableExpression) {
        return [];
    } {
        assertUnreachable(selectTableExpression);
    }
}

export function getColumnCandidatesForSimpleSelectStatement(selectStatement?: AST.SimpleSelectStatement): ColumnDescriptor[] {
    const selectElementColumns = getColumnsSimpleSelectStatement(selectStatement, true);
    const fromComputedColumns = selectStatement?.from?.sources.list.flatMap(getColumnsForTableSource) ?? [];
    return selectElementColumns.concat(fromComputedColumns);
}

function getColumnsForTableSource(source: AST.TableSource): ColumnDescriptor[] {
    const items = [source.item].concat(source.joins.map(j => j.nextItem));
    return items.flatMap(item => {
        if (AST.isTableSourceItem(item)) {
            const tableLike = getFromGlobalReference(item.table, AST.isTableLike);
            if (AST.isTableDefinition(tableLike)) {
                return tableLike.columns.filter(AST.isColumnDefinition).map(column => ({
                    name: column.name,
                    typedNode: column.dataType,
                    node: column,
                    isScopedByVariable: item.name != null
                }));
            } else if (AST.isCommonTableExpression(tableLike)) {
                let columns = getColumnsForSelectTableExpression(tableLike.statement);
                if (tableLike?.columnNames.length > 0) {
                    columns = columns.map((c, i) => ({ ...c, name: tableLike.columnNames[i]?.name }));
                }
                return columns;
            }
            return [];
        } else if (AST.isSubQuerySourceItem(item)) {
            return getColumnsForSelectTableExpression(item.subQuery);
        } else {
            assertUnreachable(item);
        }
    });
}
