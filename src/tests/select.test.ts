/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem, LangiumDocument } from "langium";
import { describe, it, expect, beforeAll } from "vitest";
import * as ast from "../language-server/generated/ast";
import { ReportAs } from "../language-server/sql-error-codes";
import { createSqlServices } from "../language-server/sql-module";
import {
  parseHelper,
  expectNoErrors,
  asSelectStatement,
  expectTableLinked,
  expectSelectItemToBeAllStarRelativeToVariable,
  expectSelectItemToBeColumnName,
  expectSelectItemToBeColumnNameRelativeToVariable,
  expectValidationIssues,
  expectSelectItemToBeNumeric,
} from "./test-utils";

const services = createSqlServices(EmptyFileSystem);

describe("SELECT use cases", () => {
  let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

  beforeAll(async () => {
    parse = await parseHelper(services.Sql, __dirname);
  });

  describe("SELECT * FROM tab", () => {
    let document: LangiumDocument<ast.SqlFile>;
    let selectStatement: ast.SelectStatement;

    beforeAll(async () => {
      document = await parse("SELECT * FROM tab;");
      selectStatement = asSelectStatement(document);
    });

    it("should have no errors", () => expectNoErrors(document));

    it("should link table", async () =>
      expectTableLinked(selectStatement, "tab"));

    it(`should link select element'´'s cross-reference against the correct definition`, () => {
      expect(selectStatement.from).not.toBeUndefined();
      expect(
        selectStatement.from!.sources.list[0].item.tableName!.table.ref!.name
      ).toBe("tab");
    });

    it("should select all-star", () => {
      expect(selectStatement.select.elements).toHaveLength(1);
      expect(selectStatement.select.elements[0].$type).toBe(ast.AllStar);
    });
  });

  describe("SELECT * FROM tab_non_existing", () => {
    let document: LangiumDocument<ast.SqlFile>;

    beforeAll(async () => {
      document = await parse("SELECT * FROM tab_non_existing;");
    });

    it("should have only linking errors", () => {
      expectNoErrors(document, { exceptFor: 'validator' });
      expect(
        document.references.filter((r) => r.error)[0].error!.message
      ).contain("tab_non_existing");
    });
  });

  describe("SELECT id, name FROM tab", () => {
    let document: LangiumDocument<ast.SqlFile>;
    let selectStatement: ast.SelectStatement;

    beforeAll(async () => {
      document = await parse("SELECT id, name FROM tab;");
      selectStatement = asSelectStatement(document);
    });

    it("should have no errors", () => expectNoErrors(document));

    it("should link table", async () =>
      expectTableLinked(selectStatement, "tab"));

    it("should link two select elements", () => {
      expectSelectItemToBeColumnName(selectStatement, 0, "tab", "id");
      expectSelectItemToBeColumnName(selectStatement, 1, "tab", "name");
    });
  });

  describe("SELECT t.id, s.name, s.* FROM tab t, tab s", () => {
    let document: LangiumDocument<ast.SqlFile>;
    let selectStatement: ast.SelectStatement;

    beforeAll(async () => {
      document = await parse("SELECT t.id, s.name, s.* FROM tab t, tab s;");
      selectStatement = asSelectStatement(document);
    });

    it("should have no errors", () => expectNoErrors(document));

    it("should link all select elements", () => {
      expectSelectItemToBeColumnNameRelativeToVariable(selectStatement, 0, 't', 'tab', 'id');
      expectSelectItemToBeColumnNameRelativeToVariable(selectStatement, 1, 's', 'tab', 'name');
      expectSelectItemToBeAllStarRelativeToVariable(selectStatement, 2, 's', 'tab');
    });
  });

  describe("SELECT s.wrong FROM tab s;", () => {
    let document: LangiumDocument<ast.SqlFile>;

    beforeAll(async () => {
      document = await parse("SELECT s.wrong FROM tab s;");
    });

    it("should have only linker errors", () => {
      expectNoErrors(document, {exceptFor: 'validator'});
      expect(
        document.references.filter((r) => r.error)[0].error!.message
      ).contain("wrong");
    });
  });

  describe("Duplicated table variable", () => {
    let document: LangiumDocument<ast.SqlFile>;

    beforeAll(async () => {
      document = await parse("SELECT * FROM tab s, tab s;");
    });

    it("should have only validator errors", () => {
      expectNoErrors(document, {exceptFor: 'validator'});
      expectValidationIssues(document, 2, ReportAs.DuplicatedVariableName.Code);
    });
  });

  describe("SELECT 12345.54321E-10", () => {
    let document: LangiumDocument<ast.SqlFile>;
    let selectStatement: ast.SelectStatement;

    beforeAll(async () => {
      document = await parse("SELECT 12345.54321E-10;");
      selectStatement = asSelectStatement(document);
    });

    it("should be evaluated as number", () => {
      expectNoErrors(document);
      expectSelectItemToBeNumeric(selectStatement, 0, 12345.54321E-10);
    });

    it("should have no from clause", () => {
      expect(selectStatement.from).toBeUndefined();
    });
  });

  describe("SELECT CAST(1.815 AS INTEGER)", () => {
    let document: LangiumDocument<ast.SqlFile>;
    let selectStatement: ast.SelectStatement;

    beforeAll(async () => {
      document = await parse("SELECT CAST(1.815 AS INTEGER);");
      selectStatement = asSelectStatement(document);
    });

    it("should be evaluated as number", () => {
      expectNoErrors(document);
      //TODO
    });
  });
});

