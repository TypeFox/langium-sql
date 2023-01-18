/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
******************************************************************************/
import { AstNode, DefaultWorkspaceManager, LangiumDocument, LangiumDocumentFactory, LangiumSharedServices, linkContentToContainer, streamAst } from "langium";
import { ColumnDefinition, SqlFile, TableDefinition, TypeDefinition } from "./generated/ast";
import { SqlTableDefinitions, SqlTypeDefinitions } from "./sql-meta";
import { SqlSharedServices } from "./sql-module";
import { URI } from 'vscode-uri';
import { WorkspaceFolder } from "vscode-languageserver";

export class SqlWorkspaceManager extends DefaultWorkspaceManager {
    private readonly tables: SqlTableDefinitions;
    private readonly dataTypes: SqlTypeDefinitions;
    private readonly langiumDocumentFactory: LangiumDocumentFactory;

    constructor(services: SqlSharedServices & LangiumSharedServices) {
        super(services);
        this.tables = services.sql.tables;
        this.dataTypes = services.sql.dataTypes;
        this.langiumDocumentFactory = services.workspace.LangiumDocumentFactory;
    }

    protected override loadAdditionalDocuments(_folders: WorkspaceFolder[], _collector: (document: LangiumDocument<AstNode>) => void): Promise<void> {
        const statements: (TypeDefinition|TableDefinition)[] = [];
        const typeMap = new Map<string, TypeDefinition>();
        for (const [name, _typeDef] of Object.entries(this.dataTypes)) {
            const dataTypeDefinition: TypeDefinition = {
                $container: undefined!,
                $type: "TypeDefinition",
                name,
            }
            typeMap.set(name, dataTypeDefinition);
            statements.push(dataTypeDefinition);
        }
        for (const [name, tableDefinition] of Object.entries(this.tables)) {
            const columns: ColumnDefinition[] = [];
            for (const [columnName, {dataTypeName}] of Object.entries(tableDefinition)) {
                if(!typeMap.has(dataTypeName)) {
                    throw new Error(`Unknown datatype '${dataTypeName}'!`);
                }
                columns.push({
                    $container: undefined!,
                    $type: 'ColumnDefinition',
                    name: columnName,
                    dataType: undefined!
                });
            }

            const finalDefinition: TableDefinition = {
                $container: undefined!,
                $type: 'TableDefinition',
                name,
                columns
            };
            statements.push(finalDefinition);
        }
        const file: SqlFile = {
            $type: "SqlFile",
            statements,
        };
        streamAst(file).forEach(node => linkContentToContainer(node));

        const uri = URI.parse(`inmemory://prelude.sql`);
        const document = this.langiumDocumentFactory.fromModel(file, uri);
        _collector(document);

        return Promise.resolve();
    }
}