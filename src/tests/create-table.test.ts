/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, LangiumDocument } from "langium";
import { beforeAll, describe, it } from "vitest";
import * as ast from "../language-server/generated/ast";
import { ReportAs } from "../language-server/sql-error-codes";
import { createSqlServices } from "../language-server/sql-module";
import {
    parseHelper,
    expectNoErrors,
    expectValidationIssues,
} from "./test-utils";

const services = createSqlServices(EmptyFileSystem);

describe("CREATE TABLE use cases", () => {
    let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
    });

    it("should have error about missing column definitions", async () => {
        const document = await parse("CREATE TABLE tab ();");
        expectNoErrors(document, {exceptFor: 'validator'});
        expectValidationIssues(document, 1, ReportAs.TableDefinitionRequiresAtLeastOneColumn.Code);
    });
});
