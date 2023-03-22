/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, CstNode, DefaultNameProvider } from "langium";
import { GlobalReference, isFunctionDefinition, isSchemaDefinition, isTableDefinition } from "./generated/ast";

export class SqlNameProvider extends DefaultNameProvider {

    override getName(node: AstNode): string | undefined {
        if (isSchemaDefinition(node) || isTableDefinition(node) || isFunctionDefinition(node)) {
            return this.getDefinitionName(node.reference);
        } else {
            return super.getName(node);
        }
    }

    override getNameNode(node: AstNode): CstNode | undefined {
        if (isSchemaDefinition(node) || isTableDefinition(node) || isFunctionDefinition(node)) {
            return this.getDefinitionNode(node.reference);
        } else {
            return super.getNameNode(node);
        }
    }

    protected getDefinitionName(reference?: GlobalReference): string | undefined {
        return reference?.element?.$refText || undefined;
    }

    protected getDefinitionNode(reference?: GlobalReference): CstNode | undefined {
        return reference?.element?.$refNode;
    }

}
