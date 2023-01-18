import { LangiumDocument } from "langium";
import { expect } from "vitest";
import * as ast from "../language-server/generated/ast";
import { SqlServices } from "../language-server/sql-module";
import { URI } from "vscode-uri";

export async function parseHelper(
  services: SqlServices
): Promise<(input: string) => Promise<LangiumDocument<ast.SqlFile>>> {
  const metaData = services.LanguageMetaData;
  const documentBuilder = services.shared.workspace.DocumentBuilder;
  await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
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
    await documentBuilder.build([document]);
    return document;
  };
}
interface ValidationStepFlags {
  lexer?: boolean;
  parser?: boolean;
  validator?: boolean;
  linker?: boolean;
}
export function expectNoErrors(
  result: LangiumDocument<ast.SqlFile>,
  flags?: ValidationStepFlags
): void {
  const { lexer, linker, parser, validator } = Object.assign(
    { lexer: true, parser: true, validator: true, linker: true },
    flags
  );
  expect(result.parseResult.lexerErrors.length > 0).toBe(!lexer);
  expect(result.parseResult.parserErrors.length > 0).toBe(!parser);
  expect(result.references.filter((r) => r.error).length > 0).toBe(!linker);
  expect(result.diagnostics?.length ?? 0 > 0).toBe(!validator);
}
export function asSelectStatement(result: LangiumDocument<ast.SqlFile>) {
  const file = result.parseResult.value;
  expect(file.statements).toHaveLength(1);
  expect(file.statements[0].$type === "SelectQuery");
  return file.statements[0] as ast.SelectStatement;
}

export function expectTableLinked(selectStatement: ast.SelectStatement, tableName: string) {
  expect(selectStatement.from).not.toBeUndefined();
  expect(selectStatement.from!.sources.list[0].item.tableName).not.toBeUndefined();
  expect(selectStatement.from!.sources.list[0].item.tableName!.table.ref).not.toBeUndefined();
  expect(selectStatement.from!.sources.list[0].item.tableName!.table.ref!.name).toBe(tableName);
}
