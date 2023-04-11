/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { startLanguageServer } from "langium";
import { NodeFileSystem } from "langium/node";
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { createSqlServices } from "langium-sql";
//import { DialectTypes } from "langium-sql/lib/sql-data-types";
//import { MySqlDialectTypes } from "langium-sql/lib/dialects/mysql/data-types";

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the shared services and language-specific services
const { shared } = createSqlServices({
    ...NodeFileSystem,
    connection,
    //module: {dialect: {dataTypes: () => new DialectTypes(MySqlDialectTypes)}}
});

// Start the language server with the shared services
startLanguageServer(shared);
