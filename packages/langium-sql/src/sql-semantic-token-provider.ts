/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as ast from "./generated/ast.js";
import { SemanticTokenTypes } from 'vscode-languageserver';
import { AbstractSemanticTokenProvider, SemanticTokenAcceptor } from "langium/lsp";
import { AstNode } from "langium";

export class SqlSemanticTokenProvider extends AbstractSemanticTokenProvider {

    protected highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void {
        if (ast.isDataType(node)) {
            acceptor({
                node,
                property: 'dataTypeNames',
                type: SemanticTokenTypes.type
            });
        } else if(ast.isStringLiteral(node)) {
            acceptor({
                node,
                property: 'value',
                type: SemanticTokenTypes.string
            });
        } else if(ast.isNumberLiteral(node)) {
            acceptor({
                node,
                property: 'value',
                type: SemanticTokenTypes.number
            });
        }
    }
}
