/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocument } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { join } from 'path';
import {beforeAll, describe, expect, it} from 'vitest'
import { MySqlDialectTypes } from '../../src/dialects/mysql/data-types.js';
import { SqlFile } from '../../src/generated/ast.js';
import { createTestServices, expectNoErrors, parseHelper } from '../test-utils.js';

const services = createTestServices(MySqlDialectTypes);

describe('SELECT Syntax coverage', () => {
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
    it('Statements without semicolon', () => expectParseable(`
        SELECT * FROM airline
        SELECT * FROM booking
    `));
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
    it('With statement: Second uses first', () => expectParseable(`
        WITH
            xxx AS SELECT * FROM booking WHERE booking_id=100,
            yyy AS SELECT * FROM xxx
        SELECT booking_id FROM yyy;
    `));
    it('Union succeeds', () => expectParseable(`
        SELECT booking_id FROM booking
        UNION
        SELECT passenger_id FROM passenger;
    `));
    it.fails('Union fails, column count mismatch', () => expectParseable(`
        SELECT booking_id, booking_id FROM booking
        UNION
        SELECT passenger_id FROM passenger;
    `));
    it.fails('Union fails, column type mismatch', () => expectParseable(`
        SELECT booking_id FROM booking
        UNION
        SELECT NULL FROM passenger;
    `));
    it('Like operator', () => expectParseable(`
        SELECT * FROM passenger WHERE lastname LIKE '%meier%' AND firstname LIKE '%ryan%';
    `));
    it('IS operator', () => expectParseable(`SELECT firstname IS NULL FROM passenger;`));
    it('IN operator with sub query', () => expectParseable(`SELECT firstname, lastname FROM passenger WHERE passenger_id IN (SELECT passenger_id FROM passenger);`));
    it('IN operator with list of values', () => expectParseable(`SELECT firstname, lastname FROM passenger WHERE passenger_id IN (1, 2, 3, 4, 5);`));
    it('Select from schema.table', () => expectParseable(`SELECT * FROM alpha.people;`));
    it('Same table name, different schemas', async () => {
        const alpha = await expectParseable(`SELECT * FROM alpha.people;`);
        const omega = await expectParseable(`SELECT * FROM omega.people;`);
        expect(alpha.references[1].ref).not.toStrictEqual(omega.references[1].ref);
    });
    it('All table columns', () => expectParseable(`SELECT p.* FROM passenger p;`));
    it.fails('Cannot select outer table', () => expectParseable(`SELECT (SELECT p.*) FROM passenger p;`));
    it('Should use also renamed columns inside of expressions', async () => {
        const document = await parse('SELECT p.passenger_id AS the_id FROM passenger p ORDER BY the_id;');
        expectNoErrors(document);
    });
    it.fails('Disallow nested WITH clause', async () => {
        const document = await parse(`
            WITH outer AS (
                WITH b AS (SELECT 911)
                SELECT * FROM b
            )
            SELECT * FROM outer;
        `);
        expectNoErrors(document);
    });
    it('Select from table relative column without using explicit table variable', () => expectParseable(`SELECT passenger.passenger_id FROM passenger;`));
    it('Select from WITH statement that uses column renamings', () => expectParseable(`
        WITH one(num) AS SELECT 1 AS wrong
        SELECT num FROM one;
    `));
    it.fails('Select from WITH statement that uses column renamings but references wrong one', () => expectParseable(`
        WITH one(num) AS SELECT 1 AS wrong
        SELECT wrong FROM one;
    `));
    it('Select COUNT(DISTINCT ...)', () => expectParseable(`
        SELECT COUNT(DISTINCT p.passenger_id) FROM passenger p; 
    `));
    it('Identifiers with different casing', () => expectParseable(`SELECT CounT(*) FROM booking WHERE flight_id=172;`));
    it('Count by distinct rows', () => expectParseable(`SELECT COUNT(DISTINCT flight_id) FROM booking;`));
    it('Escape an identifier, but still find it', () => expectParseable(`SELECT \`passenger_id\` FROM passenger;`));
    it('Namespaced functions', () => expectParseable(`SELECT alpha.blubb(123);`));
    it('OVER clause', () => expectParseable(`SELECT SUM(price) OVER (PARTITION BY seat) FROM booking;`));

    // FETCH FIRST
    it('MySQL LIMIT', () => expectParseable('SELECT * FROM alpha.people LIMIT 100;'));
    it('MySQL LIMIT with OFFSET alternative syntax', () => expectParseable('SELECT * FROM alpha.people LIMIT 200, 100;'));
    it('MySQL LIMIT with OFFSET', () => expectParseable('SELECT * FROM alpha.people LIMIT 100 OFFSET 200;'));

    it('SQL Standard FETCH FIRST', () => expectParseable('SELECT * FROM alpha.people FETCH FIRST 100 ROWS ONLY;'));
    it('SQL Standard FETCH FIRST WITH TIES', () => expectParseable('SELECT * FROM alpha.people FETCH FIRST 100 ROWS WITH TIES;'));
    it('SQL Standard FETCH FIRST WITH OFFSET', () => expectParseable('SELECT * FROM alpha.people OFFSET 200 FETCH NEXT 100 ROWS ONLY;'));
    it('ORACLE SQL FETCH FIRST WITH OFFSET ROWS', () => expectParseable('SELECT * FROM alpha.people OFFSET 200 ROWS FETCH NEXT 100 ROWS ONLY;'));
});