/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from "langium";
import { beforeAll, describe, expect, it } from "vitest";
import { SqlFile } from "../../src/generated/ast.js";
import { Types } from "../../src/sql-type-descriptors.js";
import {
    parseHelper,
    expectNoErrors,
    expectSelectItemsToBeOfType,
    expectSelectItemsToHaveNames,
    asSelectTableExpression,
    createTestServices,
    expectValidationIssues,
} from "../test-utils.js";
import { join } from "path";
import { DataTypeDefinition, parseRequiredType } from "../../src/sql-data-types.js";
import { TypeComputer } from "../../src/sql-type-computation.js";
import { MySqlDialectTypes } from "../../src/dialects/mysql/data-types.js";
import { ReportAs } from "../../src/sql-error-codes.js";

const services = createTestServices(MySqlDialectTypes);

describe("Type utilities", () => {
    it.each([
        ["1", "integer"],
        ["1E-5", "real"],
        ["1E1", "integer"],
        ["1E3", "integer"],
        ["123456", "integer"],
    ])("typeof(%s) === {%s}", (input: string, discriminator: string) => {
        expect(services.Sql.dialect.typeComputer.computeTypeOfNumericLiteral(input)!).toEqual({
            discriminator,
        });
    });

    it.each([
        ["INT", <DataTypeDefinition>{
            names: ['INT'],
            arguments: []
        }],
        ["CHARACTER VARYING(size)", <DataTypeDefinition>{
            names: ['CHARACTER', 'VARYING'],
            arguments: [{type:'size', optional: false}]
        }],
        ["DECIMAL(integer?, integer?)", <DataTypeDefinition>{
            names: ['DECIMAL'],
            arguments: [
                {type:'integer', optional: true},
                {type:'integer', optional: true}
            ]
        }],
    ])("parseRequiredType(%s)", (input: string, expected: DataTypeDefinition) => {
        expect(parseRequiredType(input)).toEqual(expected);
    });
});


describe("Type system", () => {
    let typeComputer: TypeComputer;
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        typeComputer = services.Sql.dialect.typeComputer;
        parse = await parseHelper(services.Sql, join(__dirname, '..', 'syntax', 'stdlib'));
    });

    it("CAST to unknown type", async () => {
        const document = await parse("SELECT CAST(123 AS IMAGINATION(10, 20));");
        expectNoErrors(document, {exceptFor: "validator"});
        expectValidationIssues(document, 1, ReportAs.UnknownDataType.Code)
    });

    it("CAST to known type", async () => {
        const document = await parse("SELECT CAST(123 AS DECIMAL(65, 0));");
        expectNoErrors(document);
    });

    it("addition of integer and real results in real", async () => {
        const document = await parse("SELECT 1+1.5;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Real]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });

    it("::$ operator with Identifier", async () => {
        const document = await parse("SELECT firstname::$middleName AS middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, ['middleName']);
    });
    it("::$ operator with ticked Identifier", async () => {
        const document = await parse("SELECT firstname::$\`$middleName\` FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::$ operator with NumberLiteral", async () => {
        const document = await parse("SELECT firstname::$123 FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::$ operator with a Quoted Identifier", async () => {
        const document = await parse(`SELECT firstname::\$[string] FROM passenger;`);
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("::% operator with Identifier", async () => {
        const document = await parse("SELECT firstname::%middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Real]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it(":: operator with Identifier", async () => {
        const document = await parse("SELECT firstname::middleName FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, [undefined]);
    });
    it("JSON operator chain with Identifier", async () => {
        const document = await parse("SELECT firstname::123::middle::$name AS name FROM passenger;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(typeComputer, selectStatement, [Types.Char()]);
        expectSelectItemsToHaveNames(selectStatement, ["name"]);
    });
});
