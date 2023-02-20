/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { EmptyFileSystem, LangiumDocument } from "langium";
import { beforeAll, describe, expect, it } from "vitest";
import { SqlFile } from "../language-server/generated/ast";
import { createSqlServices } from "../language-server/sql-module";
import { Types } from "../language-server/sql-type-descriptors";
import { computeTypeOfNumericLiteral } from "../language-server/sql-type-computation";
import { parseHelper, expectNoErrors, expectSelectItemsToBeOfType, asSelectStatement, expectSelectItemsToHaveNames } from "./test-utils";

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
});


const services = createSqlServices(EmptyFileSystem);

describe("Type system", () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, __dirname);
    });

    it("addition of integer and real results in real", async () => {
        const document = await parse("SELECT 1+1.5;");
        const selectStatement = asSelectStatement(document);
        expectNoErrors(document);
        expectSelectItemsToBeOfType(selectStatement, [Types.Real])
        expectSelectItemsToHaveNames(selectStatement, [undefined])
    });
});
