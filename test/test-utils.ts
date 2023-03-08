/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from "langium";
import { expect } from "vitest";
import * as ast from "../src/language-server/generated/ast";
import { SqlServices } from "../src/language-server/sql-module";
import { URI } from "vscode-uri";
import {
    TypeDescriptor,
    TypeDescriptorDiscriminator,
} from "../src/language-server/sql-type-descriptors";
import {
    ComputeTypeFunction,
    computeTypeOfSelectStatement,
} from "../src/language-server/sql-type-computation";
import assert from "assert";
import { isAllTable, SimpleSelectTableExpression } from "../src/language-server/generated/ast";
import { getColumnsForSelectTableExpression } from "../src/language-server/sql-type-utilities";
import path from "path";

export async function parseHelper(
    services: SqlServices,
    folder: string
): Promise<(input: string) => Promise<LangiumDocument<ast.SqlFile>>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    const uri = URI.file(path.resolve(folder)).toString();
    await services.shared.workspace.WorkspaceManager.initializeWorkspace([
        {
            name: "main",
            uri,
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
    expect(result.parseResult.lexerErrors.length > 0, result.parseResult.lexerErrors.length > 0 ? result.parseResult.lexerErrors[0].message : '').toBe(lexer);
    expect(result.parseResult.parserErrors.length > 0, result.parseResult.parserErrors.length > 0 ? result.parseResult.parserErrors[0].message : '').toBe(parser);
    const validationErrors = result.diagnostics ?? [];
    expect(validationErrors.length > 0, validationErrors.length>0?validationErrors[0].message:'').toBe(validator);
}

export function asTableDefinition(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type).toBe(ast.TableDefinition);
    return file.statements[0] as ast.TableDefinition;
}

export function asSelectTableExpression(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type).toBe(ast.RootLevelSelectStatement);
    const root = file.statements[0] as ast.RootLevelSelectStatement;
    return root.select;
}

export function asSimpleSelectStatement(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type).toBe(ast.RootLevelSelectStatement);
    const root = file.statements[0] as ast.RootLevelSelectStatement;
    expect(root.select.$type).toBe(SimpleSelectTableExpression);
    return (root.select as SimpleSelectTableExpression).select;
}

export function expectTableLinked(
    selectStatement: ast.SimpleSelectStatement,
    tableName: string
) {
    expect(selectStatement.from).not.toBeUndefined();
    expect(ast.isTableSourceItem(selectStatement.from!.sources.list[0]!.item))
        .toBeTruthy;
    const tableSource = selectStatement.from!.sources.list[0]
        .item as ast.TableSourceItem;
    expect(tableSource.tableName).not.toBeUndefined();
    expect(tableSource.tableName!.ref).not.toBeUndefined();
    expect(tableSource.tableName!.ref!.name).toBe(tableName);
}

export function expectSelectItemToBeColumnName(
    root: ast.RootLevelSelectStatement,
    selectElementIndex: number,
    tableName: string,
    columnName: string
) {
    const selectStatementExpression = root.select;
    assert(ast.isSimpleSelectTableExpression(selectStatementExpression));
    const selectStatement = selectStatementExpression.select;
    expect(selectStatement.$type).toBe(SimpleSelectTableExpression);
    expect(selectStatement.select.elements.length).toBeGreaterThan(
        selectElementIndex
    );
    const element = (
        selectStatement.select.elements[
            selectElementIndex
        ] as ast.ExpressionQuery
    ).expr;
    expect((element as ast.ColumnNameExpression).columnName.ref!.name).toBe(columnName);
    expect(((element as ast.ColumnNameExpression).columnName.ref!.$container as ast.TableDefinition).name).toBe(
        tableName
    );
}

export function expectSelectItemsToBeOfType(
    selectStatement: ast.SelectTableExpression,
    types: TypeDescriptor[]
): void {
    const row = computeTypeOfSelectStatement(selectStatement);
    assert(row.discriminator === "row");
    expect(row.columnTypes.map((m) => m.type)).toStrictEqual(types);
}

export function expectSelectItemsToHaveNames(selectStatement: ast.SelectTableExpression, expectedNames: (string|undefined)[]) {
    const columnDescriptors = getColumnsForSelectTableExpression(selectStatement);
    const actualNames = columnDescriptors.map(ad => ad ? ad.name : undefined);
    expect(actualNames).toStrictEqual(expectedNames);
}

export function expectSelectItemToBeNumeric(
    selectStatement: ast.SimpleSelectStatement,
    selectElementIndex: number,
    value: number
) {
    expect(selectStatement.select.elements.length).toBeGreaterThan(
        selectElementIndex
    );
    const element = selectStatement.select.elements[selectElementIndex];
    expect(element.$type).toBe(ast.ExpressionQuery);
    const query = (element as ast.ExpressionQuery).expr;
    expect(query.$type === ast.NumberLiteral);
    expect((query as ast.NumberLiteral).value).toBe(value);
}

export function expectSelectItemToBeColumnNameRelativeToVariable(
    selectStatement: ast.SimpleSelectStatement,
    selectElementIndex: number,
    variableName: string,
    tableName: string,
    columnName: string
) {
    expect(selectStatement.select.elements.length).toBeGreaterThan(
        selectElementIndex
    );
    const element = selectStatement.select.elements[selectElementIndex];
    expect(ast.isExpressionQuery(element)).toBeTruthy();
    const exprQuery = (element as ast.ExpressionQuery)
        .expr as ast.TableRelatedColumnExpression;
    expect(exprQuery.variableName.ref!.name).toBe(variableName);
    assert(ast.isTableSourceItem(exprQuery.variableName.ref));
    expect(exprQuery.variableName.ref!.tableName.ref!.name).toBe(
        tableName
    );
    expect(exprQuery.columnName!.ref!.name).toBe(columnName);
}

export function expectSelectItemToBeAllStarRelativeToVariable(
    selectStatement: ast.SimpleSelectStatement,
    selectElementIndex: number,
    variableName: string,
    tableName: string
) {
    expect(selectStatement.select.elements.length).toBeGreaterThan(
        selectElementIndex
    );
    const element = selectStatement.select.elements[selectElementIndex];
    assert(isAllTable(element));
    expect(element.variableName.ref!.name).toBe(
        variableName
    );
    assert(ast.isTableSourceItem(element.variableName.ref));
    expect(element.variableName.ref!.tableName.ref!.name).toBe(tableName);
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
    selectStatement: ast.SimpleSelectStatement,
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