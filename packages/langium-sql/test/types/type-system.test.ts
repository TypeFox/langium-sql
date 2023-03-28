/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from "langium";
import { beforeAll, describe, expect, it } from "vitest";
import { SqlFile } from "../../src/generated/ast";
import { createSqlServices } from "../../src/sql-module";
import { Types } from "../../src/sql-type-descriptors";
import { computeTypeOfNumericLiteral } from "../../src/sql-type-computation";
import {
    parseHelper,
    expectNoErrors,
    expectSelectItemsToBeOfType,
    asSimpleSelectStatement,
    expectSelectItemsToHaveNames,
    asSelectTableExpression,
} from "../test-utils";
import { NodeFileSystem } from "langium/node";
import { join } from "path";

describe("Type utilities", () => {
    it.each([
        ["1", "integer"],
        ["1E-5", "real"],
        ["1E1", "integer"],
        ["1E3", "integer"],
        ["123456", "integer"],
    ])("typeof(%s) === {%s}", (input: string, discriminator: string) => {
        expect(computeTypeOfNumericLiteral(input)!).toEqual({
            discriminator,
        });
    });
});

const services = createSqlServices(NodeFileSystem);

describe("Type system", () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, join(__dirname, '..', 'syntax', 'stdlib'));
    });

    it("addition of integer and real results in real", async () => {
        const document = await parse("SELECT 1+1.5;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Real]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });

    it("::$ operator with Identifier", async () => {
        const document = await parse("SELECT firstname::$middleName AS middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, ['middleName']);
    });
    it("::$ operator with ticked Identifier", async () => {
        const document = await parse("SELECT firstname::$\`$middleName\` FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::$ operator with NumberLiteral", async () => {
        const document = await parse("SELECT firstname::$123 FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::$ operator with StringLiteral", async () => {
        const document = await parse(`SELECT firstname::\$"string" FROM passenger;`);
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::% operator with Identifier", async () => {
        const document = await parse("SELECT firstname::%middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Real]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it(":: operator with Identifier", async () => {
        const document = await parse("SELECT firstname::middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("JSON operator chain with Identifier", async () => {
        const document = await parse("SELECT firstname::123::middle::$name AS name FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, ["name"]);
    });
});
