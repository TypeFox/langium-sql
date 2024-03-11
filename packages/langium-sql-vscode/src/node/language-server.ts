/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createConnection, ProposedFeatures } from "vscode-languageserver/node.js";

Promise.all([import('langium/node'), import('langium/lsp'), import('langium-sql')] as const)
    .then(([{NodeFileSystem}, {startLanguageServer}, {createSqlServices}]) => {
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
    });

