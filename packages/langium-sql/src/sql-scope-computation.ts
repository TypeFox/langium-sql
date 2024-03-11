/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, AstNodeDescription, DefaultScopeComputation, LangiumDocument, PrecomputedScopes } from "langium";
import { isCatalogDefinition, isDefinition, isFunctionDefinition, isSchemaDefinition, isTableDefinition, isWithClause } from "./generated/ast.js";

export class SqlScopeComputation extends DefaultScopeComputation {

    protected override exportNode(node: AstNode, exports: AstNodeDescription[], document: LangiumDocument<AstNode>): void {
        if (isCatalogDefinition(node) || isSchemaDefinition(node) || isTableDefinition(node) || isFunctionDefinition(node)) {
            if (isCatalogDefinition(node)) {
                super.exportNode(node, exports, document);
            } else {
                const reference = node.reference;
                if (reference && !reference.previous) {
                    // Only export the node to the global context if it is not scoped to another declaration
                    super.exportNode(node, exports, document);
                }
            }
            
        }
    }

    protected override processNode(node: AstNode, document: LangiumDocument<AstNode>, scopes: PrecomputedScopes): void {
        const container = node.$container;
        if (isWithClause(container)) {
            const selectStatement = container.$container;
            // A table used in a `WITH` clause needs to be visible to the root select statement
            for (const cte of container.ctes) {
                const name = this.nameProvider.getName(cte);
                if (name) {
                    scopes.add(selectStatement, this.descriptions.createDescription(cte, name, document));
                }
            }
        } else if (isDefinition(container)) {
            // Definitions come from the global scope
            // They are not added to the local scope
            return;
        } else {
            super.processNode(node, document, scopes);
        }
    }

}