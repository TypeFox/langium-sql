/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    AstNode, AstNodeDescriptionProvider, DefaultScopeProvider, EMPTY_SCOPE, LangiumServices, ReferenceInfo,
    Scope, stream, StreamScope
} from 'langium';
import { isColumnReference, isSelectQuery, TableDefinition } from './generated/ast';

export class SqlScopeProvider extends DefaultScopeProvider {

    private readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeDescriptionProvider = services.workspace.AstNodeDescriptionProvider;
    }

    override getScope(context: ReferenceInfo): Scope {
        if (isColumnReference(context.container) && context.property === 'column') {
            return this.getColumnReferenceScope(context);
        }
        if(isSelectQuery(context.container) && context.property === 'table') {
            return this.getTableScope(context);
        } 
        return super.getScope(context);
    }

    private getTableScope(_context: ReferenceInfo): Scope {
        return new StreamScope(this.indexManager.allElements('TableDefinition'));
    }

    private getColumnReferenceScope(context: ReferenceInfo): Scope {
        let container: AstNode | undefined = context.container;
        let contProp: string | undefined = undefined;
        while (container) {
            contProp = container.$containerProperty;
            container = container.$container;
            if (isSelectQuery(container) && contProp === 'columns') {
                const table = container.table.ref;
                if (table) {
                    return this.getTableColumnsScope(table);
                }
            }
        }
        return EMPTY_SCOPE;
    }

    private getTableColumnsScope(table: TableDefinition): Scope {
        return new StreamScope(
            stream(table.columns).map(c => this.astNodeDescriptionProvider.createDescription(c, c.name))
        );
    }

}
