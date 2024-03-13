/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from 'langium';
import { NodeFileSystem } from 'langium/node';
import {beforeAll, describe, expect, it} from 'vitest'
import { SqlFile } from '../../src/generated/ast.js';
import { createSqlServices } from '../../src/sql-module.js';
import { expectNoErrors, parseHelper } from '../test-utils.js';

const services = createSqlServices(NodeFileSystem);

describe('CREATE TABLE syntax coverage', () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql);
    });

    async function expectParseable(content: string) {
        const document = await parse(content);
        expectNoErrors(document);
        for (const reference of document.references) {
            expect(reference.ref).not.toBe(undefined);
        }
        return document;
    }

    it('Simple CREATE TABLE', () => expectParseable('CREATE TABLE X(Y int);'));
    it('Simple CREATE TABLE with bracket escaped identifier', () => expectParseable('CREATE TABLE X([Rule] int);'));
    it('Simple CREATE TABLE with tick escaped identifier', () => expectParseable('CREATE TABLE X(`Rule` int);'));
    it('Simple CREATE TABLE with multiple columns', () => expectParseable('CREATE TABLE X(Y int, Z real);'));
    it('Simple CREATE TABLE with nullable column', () => expectParseable('CREATE TABLE X(Y int NULL);'));
    it('Simple CREATE TABLE with non-nullable column', () => expectParseable('CREATE TABLE X(Y int NOT NULL);'));
});