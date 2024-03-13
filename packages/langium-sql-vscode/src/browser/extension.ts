/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions
} from "vscode-languageclient/browser.js";

let client: LanguageClient;

// This function is called when the extension is activated.
export function activate(context: vscode.ExtensionContext): void {
    client = startLanguageClient(context);
}

// This function is called when the extension is deactivated.
export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}

function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {

    const serverMain = vscode.Uri.joinPath(context.extensionUri, 'dist/browser/language-server.cjs');

    const worker = new Worker(serverMain.toString());

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "*", language: "sql" }],
    };

    // Create the language client and start the client.
    const client = new LanguageClient(
        "sql",
        "SQL",
        clientOptions,
        worker
    );

    // Start the client. This will also launch the server
    client.start();
    return client;
}
