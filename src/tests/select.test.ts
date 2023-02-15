/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, LangiumDocument } from "langium";
import { beforeAll, describe, expect, it } from "vitest";
import * as ast from "../language-server/generated/ast";
import { ReportAs } from "../language-server/sql-error-codes";
import { createSqlServices } from "../language-server/sql-module";
import { Types } from "../language-server/sql-type-descriptors";
import {
    parseHelper,
    expectNoErrors,
    asSelectStatement,
    expectTableLinked,
    expectValidationIssues,
    expectSelectItemToBeNumeric,
    expectSelectItemsToBeOfType,
    expectSelectItemsToHaveNames,
} from "./test-utils";

const services = createSqlServices(EmptyFileSystem);

describe("SELECT use cases", () => {
    let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
    });

    it("'SELECT (SELECT * FROM tab);' should have validation errors about too many columns within the sub query", async () => {
        const document = await parse("SELECT (SELECT * FROM tab);");
        expectValidationIssues(document, 1, ReportAs.SubQueriesWithinSelectStatementsMustHaveExactlyOneColumn.Code);
    });

    it('SELECT * FROM tab;', async () => {
        const document = await parse("SELECT * FROM tab;");
        const selectStatement = asSelectStatement(document);

        expectNoErrors(document);
        expectTableLinked(selectStatement, "tab");
        expect(selectStatement.select.elements).toHaveLength(1);
        expect(selectStatement.select.elements[0].$type).toBe(ast.AllStar);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer, Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, ['id', 'name']);
    });

    it("SELECT * FROM tab_non_existing;", async () => {
        const document = await parse("SELECT * FROM tab_non_existing;");

        expectNoErrors(document, { exceptFor: "validator" });
        expect(
            document.references.filter((r) => r.error)[0].error!.message
        ).contain("tab_non_existing");
    });

    it("SELECT id, name FROM tab", async () => {
        const document = await parse("SELECT id, name FROM tab;");
        const selectStatement = asSelectStatement(document);

        expectNoErrors(document);
        expectTableLinked(selectStatement, "tab");
        expectSelectItemsToHaveNames(selectStatement, ['id', 'name']);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer, Types.Char()]);
    });

    it("Disallow getting everything from nothing", async () => {
        const document = await parse("SELECT *;");

        expectNoErrors(document, {exceptFor: 'validator'});
        expect(document.diagnostics![0].code).toBe(ReportAs.AllStarSelectionRequiresTableSources.Code);
    });

    it("Select element is sub query of sub query of ...", async () => {
        const document = await parse("SELECT (SELECT (SELECT (SELECT (SELECT id FROM tab))));");
        const selectStatement = asSelectStatement(document);

        expectNoErrors(document);
        expectSelectItemsToHaveNames(selectStatement, ['id']);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer]);
    });

    it("Reselect from sub query", async () => {
        const document = await parse("SELECT * FROM (SELECT * FROM tab);");
        const selectStatement = asSelectStatement(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer, Types.Char()]);
    });
    

    it("should link all select elements", async () => {
        const document = await parse(
            "SELECT t.id, s.name, s.* FROM tab t, tab s;"
        );
        const selectStatement = asSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemsToHaveNames(selectStatement, ['id', 'name', 'id', 'name']);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer, Types.Char(), Types.Integer, Types.Char()]);
    });

    it("Column reference to nowhere", async () => {
        const document = await parse("SELECT s.wrong FROM tab s;");
        expectNoErrors(document, { exceptFor: "validator" });
        expect(
            document.references.filter((r) => r.error)[0].error!.message
        ).contain("wrong");
    });

    it("Duplicated table variable", async () => {
        const document = await parse("SELECT * FROM tab s, tab s;");
        expectNoErrors(document, { exceptFor: "validator" });
        expectValidationIssues(
            document,
            2,
            ReportAs.DuplicatedVariableName.Code
        );
    });

    it("Scientific numbers", async () => {
        const document = await parse("SELECT 12345.54321E-10;");
        const selectStatement = asSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemToBeNumeric(selectStatement, 0, 12345.54321e-10);
        expect(selectStatement.from).toBeUndefined();
    });

    it("Explicit cast", async () => {
        const document = await parse("SELECT CAST (12345 AS REAL);");
        const selectStatement = asSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Real]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
        expect(selectStatement.from).toBeUndefined();
    });

    it("Data type literals", async () => {
        const document = await parse("SELECT 123, 0.456, true, false, 'help';");
        const selectStatement = asSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Integer, Types.Real, Types.Boolean, Types.Boolean, Types.Char()]);
    });
});
