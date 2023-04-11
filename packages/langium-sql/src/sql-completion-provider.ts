/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode, CompletionAcceptor, CompletionContext, DefaultCompletionProvider, LangiumDocument, MaybePromise, NextFeature } from "langium";
import { AbstractElement } from "langium/lib/grammar/generated/ast";
import { isDataType } from "./generated/ast";
import { toString, DataTypeDefinition } from "./sql-data-types";
import { SqlServices } from "./sql-module";
import {CompletionItemKind, CompletionList, CompletionParams} from 'vscode-languageserver';

export class SqlCompletionProvider extends DefaultCompletionProvider {
    protected dataTypes: DataTypeDefinition[];
    constructor(services: SqlServices) {
        super(services);
        this.dataTypes = services.dialect.dataTypes.allTypes();
    }

    override getCompletion(document: LangiumDocument<AstNode>, params: CompletionParams): Promise<CompletionList | undefined> {
        return super.getCompletion(document, params);
    }

    protected override completionFor(context: CompletionContext, next: NextFeature<AbstractElement>, acceptor: CompletionAcceptor): MaybePromise<void> {
        if(isDataType(context.node) && next.property === 'dataTypeNames') {
            for(const dataType of this.dataTypes) {
                acceptor({
                    label: toString(dataType),
                    kind: CompletionItemKind.Class,
                    insertText: toString(dataType),
                });
            }
        }
        return super.completionFor(context, next, acceptor);
    }
}