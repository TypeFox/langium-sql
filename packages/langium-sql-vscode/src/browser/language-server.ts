/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createConnection, BrowserMessageReader, BrowserMessageWriter } from 'vscode-languageserver/browser.js';

Promise.all([import('langium'), import('langium/lsp'), import('langium-sql')] as const)
    .then(([{EmptyFileSystem}, {startLanguageServer}, {createSqlServices}]) => {
        /* browser specific setup code */
        const messageReader = new BrowserMessageReader(self);
        const messageWriter = new BrowserMessageWriter(self);

        const connection = createConnection(messageReader, messageWriter);

        // Inject the shared services and language-specific services
        const { shared } = createSqlServices({ connection, ...EmptyFileSystem });

        // Start the language server with the shared services
        startLanguageServer(shared);
    });
