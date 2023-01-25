/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { describe, expect, it } from "vitest";
import { computeTypeOfNumericLiteral } from "../language-server/sql-type-utilities";

describe('Type system utilities', () => {
  it.each([
    ['1', 'numeric', 1, 0],
    ['1E-5', 'numeric', 0, 5],
    ['1E1', 'numeric', 2, 0],
    ['1E3', 'numeric', 4, 0],
    ['123456', 'numeric', 6, 0],
  ])('typeof(%s) === {%s, prec: %i, scale: %i}', (input: string, discriminator: string, precision?: number, scale?: number) => {
    expect(computeTypeOfNumericLiteral(input)!).toEqual({
      discriminator,
      precision,
      scale
    });
  });
});