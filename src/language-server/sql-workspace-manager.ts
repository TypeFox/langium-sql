/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
******************************************************************************/
import { AstNode, DefaultWorkspaceManager, LangiumDocument, LangiumDocumentFactory, LangiumSharedServices } from "langium";
import { SqlSharedServices } from "./sql-module";
import { URI } from 'vscode-uri';
import { WorkspaceFolder } from "vscode-languageserver";
import { resolve } from "path";
import { readdir, readFile, stat } from "fs/promises";

export class SqlWorkspaceManager extends DefaultWorkspaceManager {
    private readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: SqlSharedServices & LangiumSharedServices) {
        super(services);
        this.langiumDocumentFactory = services.workspace.LangiumDocumentFactory;
    }

    protected override async loadAdditionalDocuments(folders: WorkspaceFolder[], _collector: (document: LangiumDocument<AstNode>) => void): Promise<void> {
        for (const folder of folders) {
            const files = await readdir(folder.uri);
            for (const file of files) {
                const filePath = resolve(folder.uri, file);
                const stats = await stat(filePath);
                if(stats.isFile() && file.endsWith('sql')) {
                    const uri = URI.parse(filePath);
                    const fileContent = await readFile(filePath, 'utf-8');
                    const document = this.langiumDocumentFactory.fromString(fileContent, uri);
                    _collector(document);
                } 
            }
        }
        return Promise.resolve();
    }
}