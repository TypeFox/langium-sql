import { EmptyFileSystem, LangiumDocument } from "langium";
import { describe, it, expect, beforeAll } from "vitest";
import { SelectQuery, SqlFile } from "../language-server/generated/ast";
import { createSqlServices, SqlServices } from '../language-server/sql-module';
import { URI } from 'vscode-uri';

const serivces = createSqlServices(EmptyFileSystem);

export async function parseHelper(services: SqlServices): Promise<(input: string) => Promise<LangiumDocument<SqlFile>>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
    return async input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const uri = URI.parse(`file:///${randomNumber}${metaData.fileExtensions[0]}`);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString<SqlFile>(input, uri);
        services.shared.workspace.LangiumDocuments.addDocument(document);
        await documentBuilder.build([document]);
        return document;
    };
}

describe('SELECT statements', () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(serivces.Sql);
    });

    it('should accept simple SELECT from existing table', async () => {
        const result = await parse('SELECT * FROM tab;');
        expect(result.parseResult.lexerErrors).toHaveLength(0);
        expect(result.parseResult.parserErrors).toHaveLength(0)
        expect(result.diagnostics).toBe(undefined)
        const file = result.parseResult.value;
        expect(file.statements).toHaveLength(1);
        expect(file.statements[0].$type === 'SelectQuery');
        const selectQuery = file.statements[0] as SelectQuery;
        expect(selectQuery.table.ref).not.toBeUndefined();
        expect(selectQuery.table.ref!.name).toBe('tab');
    });

    it('should reject simple SELECT from non-existing table', async () => {
        const result = await parse('SELECT * FROM tab_non_existing;');
        expect(result.parseResult.lexerErrors).toHaveLength(0);
        expect(result.parseResult.parserErrors).toHaveLength(0)
        expect(result.diagnostics).toBeUndefined()
        expect(result.references.map(r => r.error)).toHaveLength(1);
    });
});