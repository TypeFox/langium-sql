/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { beforeAll, describe, expect, it } from "vitest";
import {
    parseHelper,
    createTestServices,
} from "../test-utils.js";
import { join } from "path";
import { MySqlDialectTypes } from "../../src/dialects/mysql/data-types.js";

const services = createTestServices(MySqlDialectTypes);

describe("Auto-completion", () => {
    let triggerCompletion: (input: string) => Promise<string[]>;

    beforeAll(async () => {
        const parse = await parseHelper(services.Sql, join(__dirname, '..', 'syntax', 'stdlib'));
        triggerCompletion = async (input: string) => {;
            const index = input.indexOf('|');
            const finalInput = input.substring(0, index) + input.substring(index + 1);
            const document = await parse(finalInput);
            const position = document.textDocument.positionAt(index);
            const completion = await services.Sql.lsp.CompletionProvider!.getCompletion(document, {
                position: position,
                textDocument: { uri: document.uri.toString() }
            });
            return completion?.items.map(item => item.label) ?? [];
        };
    });

    it.skip("Get any completion", async () => {
        const items = await triggerCompletion("SELECT m.mana|gerId FROM managers m JOIN employees e ON m.managerId=e.id WHERE m.employeeId = 123;");

        expect(items).toContain("managerId");
    });
});
