import { EmptyFileSystem, LangiumDocument } from "langium";
import { describe, it, expect, beforeAll } from "vitest";
import * as ast from "../language-server/generated/ast";
import { createSqlServices, SqlServices } from '../language-server/sql-module';
import { URI } from 'vscode-uri';

const serivces = createSqlServices(EmptyFileSystem);

export async function parseHelper(services: SqlServices): Promise<(input: string) => Promise<LangiumDocument<ast.SqlFile>>> {
    const metaData = services.LanguageMetaData;
    const documentBuilder = services.shared.workspace.DocumentBuilder;
    await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
    return async input => {
        const randomNumber = Math.floor(Math.random() * 10000000) + 1000000;
        const uri = URI.parse(`file:///${randomNumber}${metaData.fileExtensions[0]}`);
        const document = services.shared.workspace.LangiumDocumentFactory.fromString<ast.SqlFile>(input, uri);
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

function expectNoErrors(result: LangiumDocument<ast.SqlFile>, flags?: ValidationStepFlags): void {
    const {
        lexer,
        linker,
        parser,
        validator
    } = Object.assign({lexer:true, parser: true, validator: true, linker: true}, flags);
    lexer && expect(result.parseResult.lexerErrors).toHaveLength(0);
    parser && expect(result.parseResult.parserErrors).toHaveLength(0)
    linker && expect(result.references.filter(r => r.error)).toHaveLength(0);
    validator && expect(result.diagnostics).toBe(undefined);
}

function asSelectStatement(result: LangiumDocument<ast.SqlFile>) {
    const file = result.parseResult.value;
    expect(file.statements).toHaveLength(1);
    expect(file.statements[0].$type === 'SelectQuery');
    return file.statements[0] as ast.SelectStatement;
}

describe('SELECT statements', () => {
    let parse: (input: string) => Promise<LangiumDocument<ast.SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(serivces.Sql);
    });

    describe('related with FROM clause', () => {
        it('should accept simple SELECT from existing table', async () => {
            const result = await parse('SELECT * FROM tab;');
            expectNoErrors(result);
            const selectQuery = asSelectStatement(result);
            expect(selectQuery.from!.sources.list[0].item.tableName!.table.ref!.name).toBe('tab');
        });
    
        it('should reject simple SELECT from non-existing table', async () => {
            const result = await parse('SELECT * FROM tab_non_existing;');
            expectNoErrors(result, {linker: false});
            expect(result.references.filter(r => r.error)).toHaveLength(1);
        });

        describe('and SELECT ELEMENTs', () => {
            it('should accept all-star', async () => {
                const result = await parse('SELECT * FROM tab;');
                expectNoErrors(result);
                const selectQuery = asSelectStatement(result);
                expect(selectQuery.selects.elements).toHaveLength(1);
                const selectElement = selectQuery.selects.elements[0];
                expect(selectElement.$type).toBe(ast.AllStar);
            });

            it('should accept plain column names', async () => {
                const result = await parse('SELECT id, name FROM tab;');
                expectNoErrors(result);
                const selectQuery = asSelectStatement(result);
                expect(selectQuery.selects.elements).toHaveLength(2);
                const first = selectQuery.selects.elements[0] ;
                const second = selectQuery.selects.elements[1];
                expect(first.$type).toBe(ast.ColumnName);
                expect((first as ast.ColumnName).column.ref!.name).toBe('id');
                expect(second.$type).toBe(ast.ColumnName);
                expect((second as ast.ColumnName).column.ref!.name).toBe('name');
            });

            it('should reject wrong column names', async () => {
                const result = await parse('SELECT wrong_column FROM tab;');
                expectNoErrors(result, {linker: false});
                const selectQuery = asSelectStatement(result);
                expect(selectQuery.selects.elements).toHaveLength(1);
                const first = selectQuery.selects.elements[0] ;
                expect(first.$type).toBe(ast.ColumnName);
                expect((first as ast.ColumnName).column.error).not.toBeUndefined();
            });

            it('should accept relative column names', async () => {
                const result = await parse('SELECT t.id FROM tab t;');
                expectNoErrors(result);
                const selectQuery = asSelectStatement(result);
                const first = selectQuery.selects.elements[0];
                expect(first.$type).toBe(ast.TableRelated);
                expect((first as ast.TableRelated).columnName?.column.ref?.name).toBe('id')
                expect((first as ast.TableRelated).variableName.variable.ref?.tableName.table.ref?.name).toBe('tab')
            });
        });
    });
});