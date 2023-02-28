/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AstNode,
    AstNodeDescription,
    AstNodeDescriptionProvider,
    DefaultScopeProvider,
    getContainerOfType,
    hasContainerOfType,
    LangiumServices,
    Reference,
    ReferenceInfo,
    Scope,
    Stream,
    stream,
    StreamScope,
} from "langium";
import {
    ColumnDefinition,
    isColumnDefinition,
    isColumnName,
    isColumnNameExpression,
    isCommonTableExpression,
    isConstraintDefinition,
    isKeyDefinition,
    isPrimaryKeyDefinition,
    isSelectStatement,
    isSubQuerySourceItem,
    isTableDefinition,
    isTableName,
    isTableRelatedColumnExpression,
    isTableSourceItem,
    isTableVariableName,
    PrimaryKeyDefinition,
    SelectStatement,
    TableDefinition,
} from "./generated/ast";
import {
    assertUnreachable,
    ColumnDescriptor,
    getColumnCandidatesForSelectStatement,
} from "./sql-type-utilities";

export class SqlScopeProvider extends DefaultScopeProvider {
    private readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeDescriptionProvider =
            services.workspace.AstNodeDescriptionProvider;
    }

    override getScope(context: ReferenceInfo): Scope {
        if(isPrimaryKeyDefinition(context.container)) {
            switch(context.property) {
                case 'primaryKeys':
                    const tableDef = getContainerOfType(context.container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
            }
        } else if(isKeyDefinition(context.container)) {
            switch(context.property) {
                case 'keys':
                    const tableDef = getContainerOfType(context.container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
            }
        } else if (isConstraintDefinition(context.container)) {
            switch (context.property) {
                case "from": {
                    const columns = getContainerOfType(
                        context.container,
                        isTableDefinition
                    )!.columns.filter(isColumnDefinition);
                    return this.streamColumnDefinitions(columns);
                }
                case 'table': {
                    return this.getTablesFromGlobalScope(context);
                }
                case 'to': {
                    const columns = context.container.table.ref!.columns.filter(isColumnDefinition);
                    return this.streamColumnDefinitions(columns);
                }
            }
        } else if (
            isColumnName(context.container) &&
            context.property === "column"
        ) {
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
                if (isTableSourceItem(ref)) {
                    const tableLike = ref.tableName.table.ref!;
                    if(isTableDefinition(tableLike)) {
                        const columns = tableLike.columns.filter(
                            isColumnDefinition
                        );
                        return this.streamColumnDefinitions(columns);
                    } else if(isCommonTableExpression(tableLike)) {
                        const columns = getColumnCandidatesForSelectStatement(tableLike.statement)
                        return this.streamColumnDescriptors(columns);
                    } else {
                        assertUnreachable(tableLike);
                    }
                } else if (isSubQuerySourceItem(ref)) {
                    const columns = getColumnCandidatesForSelectStatement(
                        ref.subQuery
                    );
                    const astDescriptions = columns
                        .filter((c) => !c.isScopedByVariable && c.name)
                        .map((c) =>
                            this.descriptions.createDescription(c.node, c.name!)
                        );
                    return new StreamScope(stream(astDescriptions));
                } else {
                    assertUnreachable(ref);
                }
            } else if (
                hasContainerOfType(context.container, isColumnNameExpression)
            ) {
                const expression = getContainerOfType(
                    context.container,
                    isColumnNameExpression
                )!;
                const selectStatement = getContainerOfType(
                    expression,
                    isSelectStatement
                );
                const columns = getColumnCandidatesForSelectStatement(
                    selectStatement!
                );
                const astDescriptions = columns
                    .filter((c) => !c.isScopedByVariable && c.name)
                    .map((c) =>
                        this.descriptions.createDescription(c.node, c.name!)
                    );
                return new StreamScope(stream(astDescriptions));
            } else {
                const selectStatement = getContainerOfType(
                    context.container,
                    isSelectStatement
                );
                const columns = getColumnCandidatesForSelectStatement(
                    selectStatement!
                );
                const astDescriptions = columns
                    .filter((c) => !c.isScopedByVariable && c.name)
                    .map((c) =>
                        this.descriptions.createDescription(c.node, c.name!)
                    );
                return new StreamScope(stream(astDescriptions));
            }
        }
        if (isTableName(context.container) && context.property === "table") {
            const scopes: Stream<AstNodeDescription>[] = [];
            let container = getContainerOfType(context.container, isSelectStatement);
            while(container) {
                if(container!.with) {
                    const ctes = container.with.ctes.map(c => this.astNodeDescriptionProvider.createDescription(c, c.name));
                    scopes.push(stream(ctes))
                }
                container = getContainerOfType(container.$container, isSelectStatement);
            }
            const outmost = this.getTablesFromGlobalScope(context);
            let scope = outmost;
            for (const stream of scopes.reverse()) {
                scope = new StreamScope(stream, scope);
            }
            return scope;
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
                const items = [source.item].concat(
                    source.joins.map((j) => j.nextItem)
                );
                for (const item of items) {
                    if (item.name) {
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
        return new StreamScope(this.indexManager.allElements(TableDefinition));
    }

    private streamColumnDescriptors(columns: ColumnDescriptor[]): Scope {
        return new StreamScope(stream(columns.filter(c => c.name).map(c => this.astNodeDescriptionProvider.createDescription(c.node, c.name!))));
    }

    private streamColumnDefinitions(columns: ColumnDefinition[]) {
        return new StreamScope(
            stream(
                columns.map((c) =>
                    this.astNodeDescriptionProvider.createDescription(c, c.name)
                )
            )
        );
    }    
}