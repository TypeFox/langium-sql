/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { LangiumDocument } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { join } from 'path';
import {beforeAll, describe, expect, it} from 'vitest'
import { SqlFile } from '../../src/language-server/generated/ast';
import { createSqlServices } from '../../src/language-server/sql-module';
import { expectNoErrors, parseHelper } from '../test-utils';

const services = createSqlServices(NodeFileSystem);

describe('Syntax coverage', () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, join(__dirname, 'stdlib'));
    });

    async function expectParseable(content: string) {
        const document = await parse(content);
        expectNoErrors(document);
        for (const reference of document.references) {
            expect(reference.ref).not.toBe(undefined);
        }
        return document;
    }

    it('Simple select', () => expectParseable('SELECT * FROM airline;'));
    it('Select with table variable', () => expectParseable('SELECT a.* FROM airline a;'));
    it('Join with using', () => expectParseable(`
        SELECT firstname, lastname, flightno
        FROM booking
            JOIN passenger USING (passenger_id)
            JOIN flight USING (flight_id)
        WHERE
            lastname = 'Maier';
    `));
    it('Select with condition', () => expectParseable(`SELECT booking_id, flight_id FROM booking JOIN flight USING (flight_id) WHERE flight_id=5;`));
    it('Aggregate using COUNT', () => expectParseable(`SELECT COUNT(*) FROM booking WHERE flight_id=172;`));
    it('Select between', () => expectParseable(`SELECT * FROM booking WHERE booking_id BETWEEN 1 AND 1000;`));
    it('Concat operator', () => expectParseable(`SELECT 'Hello' || ', ' || 'World!';`));
    it('With statement', () => expectParseable(`
        WITH xxx AS SELECT * FROM booking WHERE booking_id=100
        SELECT booking_id FROM xxx;
    `));
    it('Like operator', () => expectParseable(`
        SELECT * FROM passenger WHERE lastname LIKE '%meier%' AND firstname LIKE '%ryan%';
    `));
    it('IS operator', () => expectParseable(`SELECT firstname IS NULL FROM passenger;`));
    it('IN operator with sub query', () => expectParseable(`SELECT firstname, lastname FROM passenger WHERE passenger_id IN (SELECT passenger_id FROM passenger);`));
    it('Select from schema.table', () => expectParseable(`SELECT * FROM alpha.people;`));
    it('Same table name, different schemas', async () => {
        const alpha = await expectParseable(`SELECT * FROM alpha.people;`);
        const omega = await expectParseable(`SELECT * FROM omega.people;`);
        expect(alpha.references[1].ref).not.toStrictEqual(omega.references[1].ref);
    });
    it('All table columns', () => expectParseable(`SELECT p.* FROM passenger p;`));
    it.fails('Cannot select outer table', () => expectParseable(`SELECT (SELECT p.*) FROM passenger p;`));
});