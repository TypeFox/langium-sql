/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AstNodeDescription,
    AstNodeDescriptionProvider,
    DefaultScopeProvider,
    getContainerOfType,
    hasContainerOfType,
    LangiumServices,
    ReferenceInfo,
    Scope,
    stream,
    StreamScope,
} from "langium";
import {
    isColumnName,
    isColumnNameExpression,
    isSelectStatement,
    isSubQuerySourceItem,
    isTableName,
    isTableRelatedColumnExpression,
    isTableSourceItem,
    isTableVariableName,
    SelectStatement,
    TableDefinition,
} from "./generated/ast";
import { assertUnreachable, getColumnsForSelectStatement } from "./sql-type-utilities";

export class SqlScopeProvider extends DefaultScopeProvider {
    private readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeDescriptionProvider =
            services.workspace.AstNodeDescriptionProvider;
    }

    override getScope(context: ReferenceInfo): Scope {
        if (isColumnName(context.container) && context.property === "column") {
            if (
                hasContainerOfType(
                    context.container,
                    isTableRelatedColumnExpression
                )
            ) {
                const tableRelated = getContainerOfType(
                    context.container,
                    isTableRelatedColumnExpression
                )!;
                const ref = tableRelated.variableName.variable.ref!;
                if(isTableSourceItem(ref)) {
                    const columns = ref.tableName.table.ref!.columns;
                    return new StreamScope(
                        stream(
                            columns.map((c) =>
                                this.astNodeDescriptionProvider.createDescription(
                                    c,
                                    c.name
                                )
                            )
                        )
                    );
                } else if(isSubQuerySourceItem(ref)) {
                    return new StreamScope(stream(this.getColumnNamesForSelectStatement(ref.subQuery)));
                } else {
                    assertUnreachable(ref);
                }
            } else if(hasContainerOfType(context.container, isColumnNameExpression)) {
                const expression = getContainerOfType(
                    context.container,
                    isColumnNameExpression
                )!;
                const selectStatement = getContainerOfType(
                    expression,
                    isSelectStatement
                );
                const columns = getColumnsForSelectStatement(selectStatement!);
                const astDescriptions = columns.filter(c => !c.isScopedByVariable && c.name).map(c => this.descriptions.createDescription(c.node, c.name!));
                return new StreamScope(stream(astDescriptions));
            } else {
                const selectStatement = getContainerOfType(
                    context.container,
                    isSelectStatement
                );
                const columns = getColumnsForSelectStatement(selectStatement!);
                const astDescriptions = columns.filter(c => !c.isScopedByVariable && c.name).map(c => this.descriptions.createDescription(c.node, c.name!));
                return new StreamScope(stream(astDescriptions));
            }
        }
        if (isTableName(context.container) && context.property === "table") {
            return this.getTablesFromGlobalScope(context);
        }
        if (
            isTableVariableName(context.container) &&
            context.property === "variable"
        ) {
            const selectStatement = getContainerOfType(
                context.container,
                isSelectStatement
            );
            return this.getTableVariablesForSelectStatement(
                context,
                selectStatement!
            );
        }
        return super.getScope(context);
    }

    private getTableVariablesForSelectStatement(
        context: ReferenceInfo,
        selectStatement: SelectStatement
    ): Scope {
        if (selectStatement.from) {
            const astDescriptions: AstNodeDescription[] = [];
            for (const source of selectStatement.from.sources.list) {
                const items = [source.item].concat(source.joins.map(j => j.nextItem));
                for (const item of items) {
                    if(item.name) {
                        astDescriptions.push(
                            this.astNodeDescriptionProvider.createDescription(
                                item,
                                item.name
                            )
                        );
                    }
                }
            }
            return new StreamScope(stream(astDescriptions));
        }
        return super.getScope(context);
    }

    private getTablesFromGlobalScope(_context: ReferenceInfo): Scope {
        return new StreamScope(
            this.indexManager.allElements(TableDefinition)
        );
    }

    getColumnNamesForSelectStatement(query: SelectStatement): AstNodeDescription[] {
        const columns = getColumnsForSelectStatement(query);
        return columns.filter(c => c.name).map(c => this.descriptions.createDescription(c.node, c.name!));
    }
}
