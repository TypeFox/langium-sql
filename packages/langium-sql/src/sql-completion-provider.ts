/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { isDataType, isSimpleSelectStatement } from "./generated/ast.js";
import { toString, DataTypeDefinition } from "./sql-data-types.js";
import { SqlServices } from "./sql-module.js";
import {CompletionItemKind, CompletionList, CompletionParams} from 'vscode-languageserver';
import { getColumnCandidatesForSelectTableExpression } from "./sql-type-utilities.js";
import { LangiumDocument, AstNode, MaybePromise, isNamed } from "langium";
import { GrammarAST } from "langium";
import { DefaultCompletionProvider, CompletionProviderOptions, CompletionContext, NextFeature, CompletionAcceptor } from "langium/lsp";

export class SqlCompletionProvider extends DefaultCompletionProvider {
    readonly completionOptions: CompletionProviderOptions = {
        triggerCharacters: ['.']
    }
    protected dataTypes: DataTypeDefinition[];
    constructor(services: SqlServices) {
        super(services);
        this.dataTypes = services.dialect.dataTypes.allTypes();
    }

    override getCompletion(document: LangiumDocument<AstNode>, params: CompletionParams): Promise<CompletionList | undefined> {
        return super.getCompletion(document, params);
    }

    protected override completionFor(context: CompletionContext, next: NextFeature<GrammarAST.AbstractElement>, acceptor: CompletionAcceptor): MaybePromise<void> {
        if(isDataType(context.node) && next.property === 'dataTypeNames') {
            this.completeWithDataTypes(context, acceptor);
        } else if(isSimpleSelectStatement(context.node) && next.type === 'SelectElements') {
            const columnDescriptors = getColumnCandidatesForSelectTableExpression(context.node.$container);
            for (const columnDescriptor of columnDescriptors) {
                const text = columnDescriptor.name ?? (isNamed(columnDescriptor.node) ? columnDescriptor.node.name : undefined);
                acceptor(context, {
                    kind: CompletionItemKind.Field,
                    label: text,
                    insertText: text,
                });
            }
        }
        return super.completionFor(context, next, acceptor);
    }

    private completeWithDataTypes(context: CompletionContext, acceptor: CompletionAcceptor) {
        for (const dataType of this.dataTypes) {
            acceptor(context, {
                label: toString(dataType),
                kind: CompletionItemKind.Class,
                insertText: toString(dataType),
            });
        }
    }
}