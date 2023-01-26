/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { describe, expect, it } from "vitest";
import { computeTypeOfNumericLiteral } from "../language-server/sql-type-utilities";

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
