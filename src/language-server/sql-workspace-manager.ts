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
import { SqlSharedServices } from "./sql-module";
import { URI } from "vscode-uri";
import { WorkspaceFolder } from "vscode-languageserver";
import { resolve } from "path";
import { readdir, readFile, stat } from "fs/promises";

export class SqlWorkspaceManager extends DefaultWorkspaceManager {
    constructor(services: LangiumSharedServices) {
        super(services);
    }
}