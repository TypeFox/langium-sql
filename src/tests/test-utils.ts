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
import {
    TypeDescriptor,
    TypeDescriptorDiscriminator,
} from "../language-server/sql-type-descriptors";
import {
    ComputeTypeFunction,
    computeTypeOfSelectStatement,
} from "../language-server/sql-type-computation";
import assert from "assert";
import { isAllTable } from "../language-server/generated/ast";
import { getColumnsForSelectStatement } from "../language-server/sql-type-utilities";

export async function parseHelper(
    services: SqlServices,
    folder: string
): Promise<(input: string) => Promise<LangiumDocument<ast.SqlFile>>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
    /*[
        {
            name: "workspace",
            uri: folder,
        },
    ]*/
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

export function asTableDefinition(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type).toBe(ast.TableDefinition);
    return file.statements[0] as ast.TableDefinition;
}

export function asSelectStatement(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type).toBe(ast.SelectStatement);
    return file.statements[0] as ast.SelectStatement;
}

export function expectTableLinked(
    selectStatement: ast.SelectStatement,
    tableName: string
) {
    expect(selectStatement.from).not.toBeUndefined();
    expect(ast.isTableSourceItem(selectStatement.from!.sources.list[0]!.item))
        .toBeTruthy;
    const tableSource = selectStatement.from!.sources.list[0]
        .item as ast.TableSourceItem;
    expect(tableSource.tableName).not.toBeUndefined();
    expect(tableSource.tableName!.table.ref).not.toBeUndefined();
    expect(tableSource.tableName!.table.ref!.name).toBe(tableName);
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
    const element = (
        selectStatement.select.elements[
            selectElementIndex
        ] as ast.ExpressionQuery
    ).expr;
    expect((element as ast.ColumnNameExpression).columnName.column.ref!.name).toBe(columnName);
    expect(((element as ast.ColumnNameExpression).columnName.column.ref!.$container as ast.TableDefinition).name).toBe(
        tableName
    );
}

export function expectSelectItemsToBeOfType(
    selectStatement: ast.SelectStatement,
    types: TypeDescriptor[]
): void {
    const row = computeTypeOfSelectStatement(selectStatement);
    assert(row.discriminator === "row");
    expect(row.columnTypes.map((m) => m.type)).toStrictEqual(types);
}

export function expectSelectItemsToHaveNames(selectStatement: ast.SelectStatement, expectedNames: (string|undefined)[]) {
    const columnDescriptors = getColumnsForSelectStatement(selectStatement);
    const actualNames = columnDescriptors.map(ad => ad ? ad.name : undefined);
    expect(actualNames).toStrictEqual(expectedNames);
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
    expect(element.$type).toBe(ast.ExpressionQuery);
    const query = (element as ast.ExpressionQuery).expr;
    expect(query.$type === ast.NumberLiteral);
    expect((query as ast.NumberLiteral).value).toBe(value);
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
    expect(ast.isExpressionQuery(element)).toBeTruthy();
    const exprQuery = (element as ast.ExpressionQuery)
        .expr as ast.TableRelatedColumnExpression;
    expect(exprQuery.variableName.variable.ref!.name).toBe(variableName);
    assert(ast.isTableSourceItem(exprQuery.variableName.variable.ref));
    expect(exprQuery.variableName.variable.ref!.tableName.table.ref!.name).toBe(
        tableName
    );
    expect(exprQuery.columnName!.column.ref!.name).toBe(columnName);
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
    assert(isAllTable(element));
    expect(element.variableName.variable.ref!.name).toBe(
        variableName
    );
    assert(ast.isTableSourceItem(element.variableName.variable.ref));
    expect(element.variableName.variable.ref!.tableName.table.ref!.name).toBe(tableName);
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

