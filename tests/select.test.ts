import { EmptyFileSystem } from "langium";
import { expectNoIssues, parseHelper } from "langium/lib/test/langium-test";
import { describe, it, expect } from "vitest";
import { SqlFile } from "../src/language-server/generated/ast";
import { createSqlServices } from '../src/language-server/sql-module';

const serivces = createSqlServices(EmptyFileSystem);
const parse = parseHelper<SqlFile>(serivces.Sql);

describe('SELECT statements', () => {
    it('should accept simple SELECT', async () => {
        const result = await parse('SELECT * FROM tab;');
        expect(result.parseResult.lexerErrors).toHaveLength(0);
        expect(result.parseResult.parserErrors).toHaveLength(0)
        expect(result.diagnostics).toBe(undefined)
    });
});