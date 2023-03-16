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
import { parseHelper, expectNoErrors, expectSelectItemsToBeOfType, asSimpleSelectStatement, expectSelectItemsToHaveNames, asSelectTableExpression } from "../test-utils";
import { NodeFileSystem } from "langium/node";

describe("Type system utilities", () => {
    it.each([
        ["1", "integer"],
        ["1E-5", "real"],
        ["1E1", "integer"],
        ["1E3", "integer"],
        ["123456", "integer"],
    ])(
        "typeof(%s) === {%s}",
        (
            input: string,
            discriminator: string,
        ) => {
            expect(computeTypeOfNumericLiteral(input)!).toEqual({
                discriminator,
            });
        }
    );
    const services = createSqlServices(NodeFileSystem);
});

const services = createSqlServices(NodeFileSystem);

describe("Type system", () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
    });

    it("addition of integer and real results in real", async () => {
        const document = await parse("SELECT 1+1.5;");
        const selectStatement = asSelectTableExpression(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Real])
        expectSelectItemsToHaveNames(selectStatement, [undefined])
    });
});
