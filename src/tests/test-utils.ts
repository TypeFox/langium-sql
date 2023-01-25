/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from "langium";
import { expect } from "vitest";
import * as ast from "../language-server/generated/ast";
import { SqlServices } from "../language-server/sql-module";
import { URI } from "vscode-uri";
import { TypeDescriptorDiscriminator } from "../language-server/sql-type-descriptors";
import { ComputeTypeFunction } from "../language-server/sql-type-system";
export async function parseHelper(
  services: SqlServices,
  folder: string
): Promise<(input: string) => Promise<LangiumDocument<ast.SqlFile>>> {
  const metaData = services.LanguageMetaData;
  const documentBuilder = services.shared.workspace.DocumentBuilder;
  await services.shared.workspace.WorkspaceManager.initializeWorkspace([
    {
      name: "workspace",
      uri: folder,
    },
  ]);
  return async (input) => {
    const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
    const uri = URI.parse(
      `file:///${randomNumber}${metaData.fileExtensions[0]}`
    );
    const document =
      services.shared.workspace.LangiumDocumentFactory.fromString<ast.SqlFile>(
        input,
        uri
      );
    services.shared.workspace.LangiumDocuments.addDocument(document);
    await documentBuilder.build([document], { validationChecks: "all" });
    return document;
  };
}

export type ValidationStep = "lexer" | "parser" | "validator";
export interface ValidationStepFlags {
  exceptFor: ValidationStep | ValidationStep[];
}
export function expectNoErrors(
  result: LangiumDocument<ast.SqlFile>,
  flags?: ValidationStepFlags
): void {
  const list = flags
    ? typeof flags.exceptFor === "string"
      ? [flags.exceptFor]
      : flags.exceptFor
    : [];
  const lexer = list.includes("lexer");
  const parser = list.includes("parser");
  const validator = list.includes("validator");
  expect(result.parseResult.lexerErrors.length > 0).toBe(lexer);
  expect(result.parseResult.parserErrors.length > 0).toBe(parser);
  expect((result.diagnostics?.length ?? 0) > 0).toBe(validator);
}
export function asSelectStatement(result: LangiumDocument<ast.SqlFile>) {
  const file = result.parseResult.value;
  expect(file.statements).toHaveLength(1);
  expect(file.statements[0].$type).toBe("SelectStatement");
  return file.statements[0] as ast.SelectStatement;
}

export function expectTableLinked(
  selectStatement: ast.SelectStatement,
  tableName: string
) {
  expect(selectStatement.from).not.toBeUndefined();
  expect(
    selectStatement.from!.sources.list[0].item.tableName
  ).not.toBeUndefined();
  expect(
    selectStatement.from!.sources.list[0].item.tableName!.table.ref
  ).not.toBeUndefined();
  expect(
    selectStatement.from!.sources.list[0].item.tableName!.table.ref!.name
  ).toBe(tableName);
}

export function expectSelectItemToBeColumnName(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  tableName: string,
  columnName: string
) {
  expect(selectStatement.select.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.select.elements[selectElementIndex];
  expect((element as ast.ColumnName).column.ref!.name).toBe(columnName);
  expect((element as ast.ColumnName).column.ref!.$container.name).toBe(
    tableName
  );
}

export function expectSelectItemToBeNumeric(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  value: number
) {
  expect(selectStatement.select.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.select.elements[selectElementIndex];
  expect(element.$type).toBe(ast.NumericExpression);
  expect((element as ast.NumericExpression).value).toBe(value);
}

export function expectSelectItemToBeColumnNameRelativeToVariable(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  variableName: string,
  tableName: string,
  columnName: string
) {
  expect(selectStatement.select.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.select.elements[selectElementIndex];
  expect(
    (element as ast.TableRelatedColumnExpression).variableName.variable.ref!.name
  ).toBe(variableName);
  expect(
    (element as ast.TableRelatedColumnExpression).variableName.variable.ref!.tableName
      .table.ref!.name
  ).toBe(tableName);
  expect((element as ast.TableRelatedColumnExpression).columnName!.column.ref!.name).toBe(
    columnName
  );
}

export function expectSelectItemToBeAllStarRelativeToVariable(
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  variableName: string,
  tableName: string
) {
  expect(selectStatement.select.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.select.elements[selectElementIndex];
  expect((element as ast.AllTable).variableName.variable.ref!.name).toBe(
    variableName
  );
  expect(
    (element as ast.AllTable).variableName.variable.ref!.tableName.table.ref!
      .name
  ).toBe(tableName);
}

export function expectValidationIssues(
  document: LangiumDocument<ast.SqlFile>,
  count: number,
  code: string
) {
  const issuesByGivenCode = (document.diagnostics ?? []).filter(
    (d) => d.code === code
  );
  expect(issuesByGivenCode.length).toBe(count);
}

export function expectSelectItemToBeCastToType(
  computeType: ComputeTypeFunction,
  selectStatement: ast.SelectStatement,
  selectElementIndex: number,
  type: TypeDescriptorDiscriminator
) {
  expect(selectStatement.select.elements.length).toBeGreaterThan(
    selectElementIndex
  );
  const element = selectStatement.select.elements[selectElementIndex];
  expect(element.$type).toBe(ast.CastExpression);
  expect(computeType(element)!.discriminator).toBe(type);
}