import { EmptyFileSystem, LangiumDocument } from "langium";
import { describe, it, expect, beforeAll } from "vitest";
import * as ast from "../language-server/generated/ast";
import { createSqlServices } from "../language-server/sql-module";
import {
  parseHelper,
  expectNoErrors,
  asSelectStatement,
  expectTableLinked,
} from "./test-utils";

const services = createSqlServices(EmptyFileSystem);

describe("SELECT statement use cases", () => {
  let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

  beforeAll(async () => {
    parse = await parseHelper(services.Sql);
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
      expect(selectStatement.selects.elements).toHaveLength(1);
      expect(selectStatement.selects.elements[0].$type).toBe(ast.AllStar);
    });
  });

  describe("SELECT * FROM tab_non_existing", () => {
    let document: LangiumDocument<ast.SqlFile>;

    beforeAll(async () => {
      document = await parse("SELECT * FROM tab_non_existing;");
    });

    it("should have only linking errors", () => {
      expectNoErrors(document, { linker: false });
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
    })
  });

  describe("related with FROM clause", () => {
    describe("and SELECT ELEMENTs", () => {
      it("should reject wrong column names", async () => {
        const result = await parse("SELECT wrong_column FROM tab;");
        expectNoErrors(result, { linker: false });
        const selectQuery = asSelectStatement(result);
        expect(selectQuery.selects.elements).toHaveLength(1);
        const first = selectQuery.selects.elements[0];
        expect(first.$type).toBe(ast.ColumnName);
        expect((first as ast.ColumnName).column.error).not.toBeUndefined();
      });

      it("should accept relative column names", async () => {
        const result = await parse("SELECT t.id FROM tab t;");
        expectNoErrors(result);
        const selectQuery = asSelectStatement(result);
        const first = selectQuery.selects.elements[0];
        expect(first.$type).toBe(ast.TableRelated);
        expect((first as ast.TableRelated).columnName?.column.ref?.name).toBe(
          "id"
        );
        expect(
          (first as ast.TableRelated).variableName.variable.ref?.tableName.table
            .ref?.name
        ).toBe("tab");
      });
    });
  });
});

function expectSelectItemToBeColumnName(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  tableName: string,
  columnName: string
) {
  expect(selectStatement.selects.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.selects.elements[selectElementIndex];
  expect(element.$type).toBe(ast.ColumnName);
  expect((element as ast.ColumnName).column.ref!.name).toBe(columnName);
  expect((element as ast.ColumnName).column.ref!.$container.name).toBe(tableName);
}

function expectSelectItemToBeColumnNameRelativeToVariable(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  variableName: string,
  tableName: string,
  columnName: string
) {
  expect(selectStatement.selects.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.selects.elements[selectElementIndex];
  expect(element.$type).toBe(ast.TableRelated);
  expect((element as ast.TableRelated).variableName.variable.ref!.name).toBe(variableName);
  expect((element as ast.TableRelated).variableName.variable.ref!.tableName.table.ref!.name).toBe(tableName);
  expect((element as ast.TableRelated).columnName!.column.ref!.name).toBe(columnName);
}

function expectSelectItemToBeAllStarRelativeToVariable(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  variableName: string,
  tableName: string
) {
  expect(selectStatement.selects.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.selects.elements[selectElementIndex];
  expect(element.$type).toBe(ast.TableRelated);
  expect((element as ast.TableRelated).allStar).toBeTruthy();
  expect((element as ast.TableRelated).variableName.variable.ref!.name).toBe(variableName);
  expect((element as ast.TableRelated).variableName.variable.ref!.tableName.table.ref!.name).toBe(tableName);
}