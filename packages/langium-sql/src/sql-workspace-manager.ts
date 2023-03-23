/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import {
    AstNode,
    DefaultWorkspaceManager,
    LangiumDocument,
    LangiumDocumentFactory,
    LangiumSharedServices,
} from "langium";
import { URI } from "vscode-uri";
import { WorkspaceFolder } from "vscode-languageserver";

export class SqlWorkspaceManager extends DefaultWorkspaceManager {

    initializationFiles: string[] = [];

    protected readonly factory: LangiumDocumentFactory;

    constructor(services: LangiumSharedServices) {
        super(services);
        this.factory = services.workspace.LangiumDocumentFactory;
        services.lsp.LanguageServer.onInitialize(params => {
            const files = params.initializationOptions?.files;
            if (Array.isArray(files)) {
                this.initializationFiles.push(...files);
            }
        });
    }

    protected override async loadAdditionalDocuments(_folders: WorkspaceFolder[], collector: (document: LangiumDocument<AstNode>) => void): Promise<void> {
        for (let i = 0; i < this.initializationFiles.length; i++) {
            const file = this.initializationFiles[i];
            const uri = URI.parse(`inmemory:///builtin_${i}.sql`);
            const document = this.factory.fromString(file, uri);
            collector(document);
        }
    }
}