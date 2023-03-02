/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AstNode,
    AstNodeDescription,
    AstNodeDescriptionProvider,
    AstNodeLocator,
    DefaultScopeProvider,
    getContainerOfType,
    hasContainerOfType,
    LangiumDocuments,
    LangiumServices,
    NamedAstNode,
    Reference,
    ReferenceInfo,
    Scope,
    assertUnreachable,
    stream,
    StreamScope,
} from "langium";
import {
    AllTable,
    ColumnDefinition,
    ColumnNameExpression,
    ConstraintDefinition,
    FunctionCall,
    FunctionDefinition,
    isAllTable,
    isColumnDefinition,
    isColumnNameExpression,
    isCommonTableExpression,
    isConstraintDefinition,
    isFunctionCall,
    isKeyDefinition,
    isPrimaryKeyDefinition,
    isRootLevelSelectStatement,
    isSimpleSelectStatement,
    isSubQuerySourceItem,
    isTableDefinition,
    isTableRelatedColumnExpression,
    isTableSourceItem,
    KeyDefinition,
    PrimaryKeyDefinition,
    SchemaDefinition,
    SimpleSelectStatement,
    SqlAstType,
    TableDefinition,
    TableRelatedColumnExpression,
    TableSourceItem,
} from "./generated/ast";
import {
    ColumnDescriptor, getColumnCandidatesForSelectTableExpression, getColumnCandidatesForSimpleSelectStatement,
} from "./sql-type-utilities";


/**
 * Returns a type to have only properties names (!) of a type T whose property value is of a certain type K.
 */
type ExtractKeysOfValueType<T, K> = { [I in keyof T]: T[I] extends K ? I : never }[keyof T];

/**
 * Returns the property names (!) of an AstNode that are cross-references.
 * Meant to be used during cross-reference resolution in combination with `assertUnreachable(context.property)`.
 */
export type CrossReferencesOfAstNodeType<N extends AstNode> = (
    ExtractKeysOfValueType<N, Reference|undefined>
    | ExtractKeysOfValueType<N, Array<Reference|undefined>|undefined>
// eslint-disable-next-line @typescript-eslint/ban-types
) & {};

/**
 * Represents the enumeration-like type, that lists all AstNode types of your grammar.
 */
export type AstTypeList<T> = Record<keyof T, AstNode>;

/**
 * Returns all types that contain cross-references, A is meant to be the interface `XXXAstType` fromm your generated `ast.ts` file.
 * Meant to be used during cross-reference resolution in combination with `assertUnreachable(context.container)`.
 */
export type AstNodeTypesWithCrossReferences<A extends AstTypeList<A>> = {
    [T in keyof A]: CrossReferencesOfAstNodeType<A[T]> extends never ? never : A[T]
}[keyof A];


type CrossReferencesOf<N extends AstNode> = CrossReferencesOfAstNodeType<N>;
type SqlAstTypesWithCrossReferences = AstNodeTypesWithCrossReferences<SqlAstType>;

export class SqlScopeProvider extends DefaultScopeProvider {
    private readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;
    private readonly astNodeLocator: AstNodeLocator;
    private readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeDescriptionProvider = services.workspace.AstNodeDescriptionProvider;
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    override getScope(context: ReferenceInfo): Scope {
        const container = context.container as SqlAstTypesWithCrossReferences;
        if(isTableDefinition(container)) {
            const property = context.property as CrossReferencesOf<TableDefinition>;
            switch(property) {
                case 'schemaName': {
                    return this.getSchemasFromGlobalScope();
                }
                default:
                    assertUnreachable(property);
            }
        } else if(isPrimaryKeyDefinition(container)) {
            const property = context.property as CrossReferencesOf<PrimaryKeyDefinition>;
            switch(property) {
                case 'primaryKeys':
                    const tableDef = getContainerOfType(container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
                default:
                    assertUnreachable(property);
            }
        } else if(isKeyDefinition(container)) {
            const property = context.property as CrossReferencesOf<KeyDefinition>;
            switch(property) {
                case 'keys':
                    const tableDef = getContainerOfType(container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
                default:
                        assertUnreachable(property);
            }
        } else if (isConstraintDefinition(container)) {
            const property = context.property as CrossReferencesOf<ConstraintDefinition>;
            switch (property) {
                case "from": {
                    const columns = getContainerOfType(
                        container,
                        isTableDefinition
                    )!.columns.filter(isColumnDefinition);
                    return this.streamColumnDefinitions(columns);
                }
                case 'table': {
                    return this.getTablesFromGlobalScope();
                }
                case 'to': {
                    const columns = container.table.ref!.columns.filter(isColumnDefinition);
                    return this.streamColumnDefinitions(columns);
                }
                default:
                    assertUnreachable(property);
            }
        } else if(isAllTable(container)) {
            const property = context.property as CrossReferencesOf<AllTable>;
            switch(property) {
                case "variableName": {
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    //ATTENTION! Do not recursively traverse upwards, t.* only looks up t in the current select statement
                    return new StreamScope(stream(this.getTableVariablesForSelectStatement(selectStatement)));
                }
                default:
                    assertUnreachable(property);
            }
        } else if(isTableRelatedColumnExpression(container)) {
            const property = context.property as CrossReferencesOf<TableRelatedColumnExpression>;
            switch(property) {
                case "variableName":
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    return this.getTableVariablesForSelectStatementRecursively(context, selectStatement);
                case "columnName":
                    const sourceItem = container.variableName.ref;
                    if(sourceItem) {
                        if(isTableSourceItem(sourceItem)) {
                            const tableLike = sourceItem.tableName.ref;
                            if(tableLike) {
                                if(isTableDefinition(tableLike)) {
                                    return this.streamColumnDefinitions(tableLike.columns.filter(isColumnDefinition));
                                } else if(isCommonTableExpression(tableLike)) {
                                    const candidates = getColumnCandidatesForSelectTableExpression(tableLike.statement);
                                    return this.streamColumnDescriptors(candidates);
                                } else {
                                    assertUnreachable(tableLike);
                                }
                            }
                        } else if(isSubQuerySourceItem(sourceItem)) {
                            const selectStatement = sourceItem.subQuery;
                            const candidates = getColumnCandidatesForSelectTableExpression(selectStatement);
                            return this.streamColumnDescriptors(candidates);
                        } else {
                            assertUnreachable(sourceItem);
                        }
                    }
                    break;
                default:
                    assertUnreachable(property);
            }
        } else if(isColumnNameExpression(container)) {
            const property = context.property as CrossReferencesOf<ColumnNameExpression>;
            switch(property) {
                case 'columnName':
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    const candidates = getColumnCandidatesForSimpleSelectStatement(selectStatement);
                    return this.streamColumnDescriptors(candidates);
                default:
                    assertUnreachable(property);
            }
        } else if(isFunctionCall(container)) {
            const property = context.property as CrossReferencesOf<FunctionCall>;
            switch(property) {
                case 'functionName':
                    return this.getFunctionsFromGlobalScope();
                default:
                    assertUnreachable(property);
            }
        } else if(isTableSourceItem(container)) {
            const property = context.property as CrossReferencesOf<TableSourceItem>;
            switch(property) {
                case 'schemaName':
                    return this.getSchemasFromGlobalScope();
                case 'tableName':
                    const schema = container.schemaName?.ref;
                    const allTables = this.getTablesFromGlobalScope();
                    const globalCandidates = allTables.getAllElements().toArray()
                        .map(d => {
                            const document = this.langiumDocuments.getOrCreateDocument(d.documentUri)!;
                            return this.astNodeLocator.getAstNode(document.parseResult.value, d.path) as TableDefinition;
                        })
                        .filter(td => td.schemaName?.ref === schema);
                    let candidates: NamedAstNode[] = globalCandidates;
                    if(!schema) {
                        const selectStatement = getContainerOfType(container, isRootLevelSelectStatement)!;
                        const withClause = selectStatement.with;
                        if(withClause) {
                            candidates = candidates.concat(withClause.ctes);
                        }
                    }
                    return new StreamScope(stream(candidates.map(td => this.astNodeDescriptionProvider.createDescription(td, td.name))));
                default:
                    assertUnreachable(property);
            }
        } else {
            assertUnreachable(container);
        }
        return super.getScope(context);
    }

    private getTableVariablesForSelectStatementRecursively(
        context: ReferenceInfo,
        selectStatement: SimpleSelectStatement
    ): Scope {
        let outerScope: Scope|undefined = undefined;

        if(hasContainerOfType(selectStatement.$container, isSimpleSelectStatement)) {
            const outerSelectStatement = getContainerOfType(selectStatement.$container, isSimpleSelectStatement)!;
            outerScope = this.getTableVariablesForSelectStatementRecursively(context, outerSelectStatement);
        }

        const descriptions = this.getTableVariablesForSelectStatement(selectStatement);

        return new StreamScope(stream(descriptions), outerScope);
    }

    private getTableVariablesForSelectStatement(
        selectStatement: SimpleSelectStatement
    ): AstNodeDescription[] {
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
            return astDescriptions;
        }
        return [];
    }

    private getTablesFromGlobalScope(): Scope {
        return new StreamScope(this.indexManager.allElements(TableDefinition));
    }

    private getSchemasFromGlobalScope(): Scope {
        return new StreamScope(this.indexManager.allElements(SchemaDefinition));
    }

    private getFunctionsFromGlobalScope(): Scope {
        return new StreamScope(this.indexManager.allElements(FunctionDefinition));
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