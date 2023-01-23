/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
******************************************************************************/
import { AstNode, DefaultWorkspaceManager, LangiumDocument, LangiumDocumentFactory, LangiumSharedServices, linkContentToContainer, streamAst } from "langium";
import { SqlSharedServices } from "./sql-module";
import { URI } from 'vscode-uri';
import { WorkspaceFolder } from "vscode-languageserver";
import { join, resolve } from "path";
import { readFile } from "fs/promises";

export class SqlWorkspaceManager extends DefaultWorkspaceManager {
    private readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: SqlSharedServices & LangiumSharedServices) {
        super(services);
        this.langiumDocumentFactory = services.workspace.LangiumDocumentFactory;
    }

    protected override async loadAdditionalDocuments(_folders: WorkspaceFolder[], _collector: (document: LangiumDocument<AstNode>) => void): Promise<void> {
        const uri = URI.parse('inmemory://prelude.sql');
        const fileContent = await readFile(resolve(join(__dirname, 'prelude.sql')), 'utf-8');
        const document = this.langiumDocumentFactory.fromString(fileContent, uri);
        _collector(document);
        return Promise.resolve();
    }
}