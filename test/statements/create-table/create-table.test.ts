/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from "langium";
import { NodeFileSystem } from "langium/node";
import { beforeAll, describe, it } from "vitest";
import * as ast from "../../../src/language-server/generated/ast";
import { ReportAs } from "../../../src/language-server/sql-error-codes";
import { createSqlServices } from "../../../src/language-server/sql-module";
import {
    parseHelper,
    expectNoErrors,
    expectValidationIssues,
} from "../../test-utils";

const services = createSqlServices(NodeFileSystem);

describe("CREATE TABLE use cases", () => {
    let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
    });

    it.skip("should have error about missing column definitions", async () => {
        const document = await parse("CREATE TABLE tab_empty ();");
        expectNoErrors(document, {exceptFor: 'validator'});
        expectValidationIssues(document, 1, ReportAs.TableDefinitionRequiresAtLeastOneColumn.Code);
    });
});
