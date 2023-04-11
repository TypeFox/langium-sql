/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from "langium";
import { beforeAll, describe, expect, it } from "vitest";
import { MySqlDialectTypes } from "../../../src/dialects/mysql/data-types";
import * as ast from "../../../src/generated/ast";
import { ReportAs } from "../../../src/sql-error-codes";
import { TypeComputer } from "../../../src/sql-type-computation";
import { Types } from "../../../src/sql-type-descriptors";
import {
    parseHelper,
    expectNoErrors,
    asSimpleSelectStatement,
    expectTableLinked,
    expectValidationIssues,
    expectSelectItemToBeNumeric,
    expectSelectItemsToBeOfType,
    expectSelectItemsToHaveNames,
    asSelectTableExpression,
    createTestServices,
} from "../../test-utils";

const services = createTestServices(MySqlDialectTypes);

describe("SELECT use cases", () => {
    let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;
    let typeComputer: TypeComputer;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
        typeComputer = services.Sql.dialect.typeComputer;
    });

    it("'SELECT (SELECT * FROM tab);' should have validation errors about too many columns within the sub query", async () => {
        const document = await parse("SELECT (SELECT * FROM tab);");
        expectValidationIssues(document, 1, ReportAs.SubQueriesWithinSelectStatementsMustHaveExactlyOneColumn.Code);
    });

    it('SELECT * FROM tab;', async () => {
        const document = await parse("SELECT * FROM tab;");
        
        const tableExpression = asSelectTableExpression(document);
        const simpleSelectStatement = asSimpleSelectStatement(document);

        expectNoErrors(document);
        expectTableLinked(simpleSelectStatement, "tab");
        expect(simpleSelectStatement.select.elements).toHaveLength(1);
        expect(simpleSelectStatement.select.elements[0].$type).toBe(ast.AllStar);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer, Types.Char()]);
        expectSelectItemsToHaveNames(tableExpression, ['id', 'name']);
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
        
        const tableExpression = asSelectTableExpression(document);
        const simpleSelectStatement = asSimpleSelectStatement(document);

        expectNoErrors(document);
        expectTableLinked(simpleSelectStatement, "tab");
        expectSelectItemsToHaveNames(tableExpression, ['id', 'name']);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer, Types.Char()]);
    });

    it("Disallow getting everything from nothing", async () => {
        const document = await parse("SELECT *;");

        expectNoErrors(document, {exceptFor: 'validator'});
        expect(document.diagnostics![0].code).toBe(ReportAs.AllStarSelectionRequiresTableSources.Code);
    });

    it("Select element is sub query of sub query of ...", async () => {
        const document = await parse("SELECT (SELECT (SELECT (SELECT (SELECT id FROM tab))));");
        
        const tableExpression = asSelectTableExpression(document);

        expectNoErrors(document);
        expectSelectItemsToHaveNames(tableExpression, ['id']);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer]);
    });

    it("Reselect from sub query", async () => {
        const document = await parse("SELECT * FROM (SELECT * FROM tab);");
        
        const tableExpression = asSelectTableExpression(document);

        expectSelectItemsToHaveNames(tableExpression, ["id", "name"]);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer, Types.Char()]);
    });
    

    it("should link all select elements", async () => {
        const document = await parse(
            "SELECT t.id, s.name, s.* FROM tab t, tab s;"
        );

        const tableExpression = asSelectTableExpression(document);

        expectNoErrors(document);
        expectSelectItemsToHaveNames(tableExpression, ['id', 'name', 'id', 'name']);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer, Types.Char(), Types.Integer, Types.Char()]);
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
        const selectStatement = asSimpleSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemToBeNumeric(selectStatement, 0, 12345.54321e-10);
        expect(selectStatement.from).toBeUndefined();
    });

    it("Explicit cast", async () => {
        const document = await parse("SELECT CAST (12345 AS REAL);");
        
        const tableExpression = asSelectTableExpression(document);
        const selectStatement = asSimpleSelectStatement(document);

        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Real]);
        expectSelectItemsToHaveNames(tableExpression, [undefined]);
        expect(selectStatement.from).toBeUndefined();
    });

    it("Data type literals", async () => {
        const document = await parse("SELECT 123, 0.456, true, false, 'help';");

        const tableExpression = asSelectTableExpression(document);

        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, tableExpression, [Types.Integer, Types.Real, Types.Boolean, Types.Boolean, Types.Char()]);
    });

    it('Should complain about missing table p (p.* searches within current select statement only!)', async () => {
        const document = await parse('SELECT (SELECT p.*) FROM passenger p;');
        expectNoErrors(document, {exceptFor: 'validator'});
        expect(document.references[0].ref).toBeUndefined();
    })
});
