/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DocumentState, interruptAndCheck, LangiumDocuments, MultiMap } from "langium";
import { CancellationToken } from "vscode-languageserver";
import { Definition, FunctionDefinition, isFunctionDefinition, isSchemaDefinition, isSqlFile, isTableDefinition, ReferenceDefinition, SchemaDefinition, SqlFile, TableDefinition } from "./generated/ast";
import { SqlSharedServices } from "./sql-module";

export class SqlContainerManager {

    protected readonly children = new MultiMap<Definition, Definition>();
    protected readonly langiumDocuments: LangiumDocuments;

    constructor(services: SqlSharedServices) {
        this.langiumDocuments = services.workspace.LangiumDocuments;
        services.workspace.DocumentBuilder.onBuildPhase(DocumentState.IndexedContent, (_, cancelToken) => this.rebuild(cancelToken));
    }

    getChildren(definition: Definition): readonly Definition[] {
        return this.children.get(definition);
    }

    putChild(definition: Definition, child: Definition): void {
        this.children.add(definition, child);
    }

    protected async rebuild(cancelToken: CancellationToken): Promise<void> {
        this.children.clear();
        const documents = this.langiumDocuments.all;
        const sink: SqlContainerSink = {
            schemas: [],
            tables: [],
            functions: []
        };
        for (const document of documents) {
            const value = document.parseResult.value;
            if (isSqlFile(value)) {
                await this.collectDocument(value, sink, cancelToken);
            }
        }
        await this.collectElements(sink.schemas, cancelToken);
        await this.collectElements(sink.tables, cancelToken);
        await this.collectElements(sink.functions, cancelToken);
    }

    protected async collectElements(elements: ReferenceDefinition[], cancelToken: CancellationToken): Promise<void> {
        for (const element of elements) {
            await interruptAndCheck(cancelToken);
            const reference = element.reference;
            if (reference?.previous) {
                const previousElement = reference.previous.element?.ref;
                if (previousElement) {
                    this.putChild(previousElement, element);
                }
            }
        }
    }

    protected async collectDocument(file: SqlFile, sink: SqlContainerSink, cancelToken: CancellationToken): Promise<void> {
        for (const statement of file.statements) {
            await interruptAndCheck(cancelToken);
            if (isSchemaDefinition(statement)) {
                sink.schemas.push(statement);
            } else if (isTableDefinition(statement)) {
                sink.tables.push(statement);
            } else if (isFunctionDefinition(statement)) {
                sink.functions.push(statement);
            }
        }
    }
}

export interface SqlContainerSink {
    schemas: SchemaDefinition[];
    tables: TableDefinition[];
    functions: FunctionDefinition[];
}