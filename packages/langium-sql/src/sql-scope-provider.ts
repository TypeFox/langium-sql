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
    NamedAstNode,
    Reference,
    ReferenceInfo,
    Scope,
    assertUnreachable,
    stream,
    StreamScope,
    Stream,
    streamAllContents,
    EMPTY_SCOPE,
} from "langium";
import {
    AllTable,
    ColumnDefinition,
    ColumnNameExpression,
    ConstraintDefinition,
    IndexDefinition,
    isAllTable,
    isColumnDefinition,
    isColumnNameExpression,
    isCommonTableExpression,
    isConstraintDefinition,
    isGlobalReference,
    isIndexDefinition,
    isKeyDefinition,
    isOverClause,
    isPrimaryKeyDefinition,
    isSimpleSelectStatement,
    isSubQuerySourceItem,
    isTableDefinition,
    isTableLike,
    isTableRelatedColumnExpression,
    isTableSourceItem,
    isWindowSpec,
    KeyDefinition,
    OverClause,
    PrimaryKeyDefinition,
    SimpleSelectStatement,
    SqlAstType,
    TableRelatedColumnExpression,
} from "./generated/ast";
import { SqlContainerManager } from "./sql-container-manager";
import { SqlServices } from "./sql-module";
import {
    ColumnDescriptor, getColumnCandidatesForSelectTableExpression, getColumnCandidatesForSimpleSelectStatement, getFromGlobalReference,
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
    ExtractKeysOfValueType<N, Reference | undefined>
    | ExtractKeysOfValueType<N, Array<Reference | undefined> | undefined>
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

    protected readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly containerManager: SqlContainerManager;

    constructor(services: SqlServices) {
        super(services);
        this.astNodeDescriptionProvider = services.workspace.AstNodeDescriptionProvider;
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
        this.containerManager = services.shared.workspace.ContainerManager;
    }

    override getScope(context: ReferenceInfo): Scope {
        const container = context.container as SqlAstTypesWithCrossReferences;
        if (isGlobalReference(container)) {
            const previous = container.previous;
            if (previous) {
                const element = previous.element?.ref;
                if (element) {
                    return this.createScopeForNodes(this.containerManager.getChildren(element));
                } else {
                    return EMPTY_SCOPE;
                }
            } else {
                // Use lexical scoping if no previous element has been assigned
                return super.getScope(context);
            }
        } else if (isPrimaryKeyDefinition(container)) {
            const property = context.property as CrossReferencesOf<PrimaryKeyDefinition>;
            switch (property) {
                case 'primaryKeys':
                    const tableDef = getContainerOfType(container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
                default:
                    assertUnreachable(property);
            }
        } else if (isIndexDefinition(container)) {
            const property = context.property as CrossReferencesOf<IndexDefinition>;
            switch (property) {
                case 'indexes':
                    const tableDef = getContainerOfType(container, isTableDefinition)!;
                    return this.streamColumnDefinitions(tableDef.columns.filter(isColumnDefinition));
                default:
                    assertUnreachable(property);
            }
        } else if (isKeyDefinition(container)) {
            const property = context.property as CrossReferencesOf<KeyDefinition>;
            switch (property) {
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
                case 'to': {
                    const columns = getFromGlobalReference(container.table, isTableDefinition)?.columns.filter(isColumnDefinition);
                    return this.streamColumnDefinitions(columns ?? []);
                }
                default:
                    assertUnreachable(property);
            }
        } else if (isAllTable(container)) {
            const property = context.property as CrossReferencesOf<AllTable>;
            switch (property) {
                case "variableName": {
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    //ATTENTION! Do not recursively traverse upwards, t.* only looks up t in the current select statement
                    return this.newCaseInsensitiveScope(stream(this.getTableVariablesForSelectStatement(selectStatement)));
                }
                default:
                    assertUnreachable(property);
            }
        } else if (isTableRelatedColumnExpression(container)) {
            const property = context.property as CrossReferencesOf<TableRelatedColumnExpression>;
            switch (property) {
                case "variableName":
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    return this.getTableVariablesForSelectStatementRecursively(context, selectStatement);
                case "columnName":
                    const sourceItem = container.variableName.ref;
                    if (sourceItem) {
                        if (isTableSourceItem(sourceItem)) {
                            const tableLike = getFromGlobalReference(sourceItem.table, isTableLike);
                            if (tableLike) {
                                if (isTableDefinition(tableLike)) {
                                    return this.streamColumnDefinitions(tableLike.columns.filter(isColumnDefinition));
                                } else if (isCommonTableExpression(tableLike)) {
                                    const candidates = getColumnCandidatesForSelectTableExpression(tableLike.statement);
                                    return this.streamColumnDescriptors(candidates);
                                } else {
                                    assertUnreachable(tableLike);
                                }
                            }
                        } else if (isSubQuerySourceItem(sourceItem)) {
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
        } else if (isColumnNameExpression(container)) {
            const property = context.property as CrossReferencesOf<ColumnNameExpression>;
            switch (property) {
                case 'columnName':
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    const candidates = getColumnCandidatesForSimpleSelectStatement(selectStatement);
                    return this.streamColumnDescriptors(candidates);
                default:
                    assertUnreachable(property);
            }
        } else if (isOverClause(container)) {
            const property = context.property as CrossReferencesOf<OverClause>;
            switch (property) {
                case 'windowName':
                    const selectStatement = getContainerOfType(container, isSimpleSelectStatement)!;
                    const nodes = streamAllContents(selectStatement).filter(isWindowSpec).toArray() as NamedAstNode[];
                    return this.packToDescriptions(nodes);
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
        let outerScope: Scope | undefined = undefined;

        if (hasContainerOfType(selectStatement.$container, isSimpleSelectStatement)) {
            const outerSelectStatement = getContainerOfType(selectStatement.$container, isSimpleSelectStatement)!;
            outerScope = this.getTableVariablesForSelectStatementRecursively(context, outerSelectStatement);
        }

        const descriptions = this.getTableVariablesForSelectStatement(selectStatement);

        return this.newCaseInsensitiveScope(stream(descriptions), outerScope);
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
                    } else {
                        if (isTableSourceItem(item)) {
                            const tableLike = getFromGlobalReference(item.table, isTableLike);
                            if (tableLike) {
                                const name = this.nameProvider.getName(tableLike);
                                if (name) {
                                    astDescriptions.push(
                                        this.astNodeDescriptionProvider.createDescription(
                                            item,
                                            name
                                        )
                                    );
                                }
                            }
                        } else if (!isSubQuerySourceItem(item)) {
                            assertUnreachable(item);
                        }
                    }
                }
            }
            return astDescriptions;
        }
        return [];
    }

    override getGlobalScope(nodeType: string, _context: ReferenceInfo): Scope {
        return this.newCaseInsensitiveScope(this.indexManager.allElements(nodeType));
    }

    protected unpackFromDescriptions<N extends NamedAstNode>(scope: Scope) {
        return scope.getAllElements().toArray()
            .map(d => {
                const document = this.langiumDocuments.getOrCreateDocument(d.documentUri)!;
                return this.astNodeLocator.getAstNode(document.parseResult.value, d.path) as N;
            });
    }

    protected packToDescriptions<N extends NamedAstNode>(nodes: N[]): Scope {
        return this.newCaseInsensitiveScope(
            stream(
                nodes.map((c) =>
                    this.astNodeDescriptionProvider.createDescription(c, c.name)
                )
            )
        );
    }

    private streamColumnDescriptors(columns: ColumnDescriptor[]): Scope {
        return this.newCaseInsensitiveScope(stream(columns.filter(c => c.name).map(c => this.astNodeDescriptionProvider.createDescription(c.node, c.name!))));
    }

    private streamColumnDefinitions(columns: ColumnDefinition[]) {
        return this.packToDescriptions(columns);
    }

    private newCaseInsensitiveScope(stream: Stream<AstNodeDescription>, outerScope: Scope | undefined = undefined) {
        return new StreamScope(stream, outerScope, { caseInsensitive: true });
    }
}