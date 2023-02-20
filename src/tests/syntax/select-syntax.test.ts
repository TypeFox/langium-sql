/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { EmptyFileSystem, LangiumDocument } from 'langium';
import { join } from 'path';
import {beforeAll, describe, it} from 'vitest'
import { SqlFile } from '../../language-server/generated/ast';
import { createSqlServices } from '../../language-server/sql-module';
import { expectNoErrors, parseHelper } from '../test-utils';

const services = createSqlServices(EmptyFileSystem);

describe('Syntax coverage', () => {
    let parse: (input: string) => Promise<LangiumDocument<SqlFile>>;

    beforeAll(async () => {
        parse = await parseHelper(services.Sql, join(__dirname, 'stdlib'));
    });

    async function expectParseable(content: string) {
        const document = await parse(content);
        expectNoErrors(document);
    }

    it('TP1', () => expectParseable('SELECT * FROM airline;'));
    it('TP2', () => expectParseable('SELECT a.* FROM airline a;'));
    it('TP3', () => expectParseable(`
        SELECT firstname, lastname, flightno
        FROM booking
            JOIN passenger USING (passenger_id)
            JOIN flight USING (flight_id)
        WHERE
            lastname = 'Maier';
    `));
    it('TP4', () => expectParseable(`SELECT booking_id, flight_id FROM booking JOIN flight USING (flight_id) WHERE flight_id=5;`));
    it('TP5', () => expectParseable(`SELECT COUNT(*) FROM booking WHERE flight_id=172;`));

    it('FP1', () => expectParseable(`
        SELECT * FROM passenger WHERE lastname LIKE '%meier%' AND firstname LIKE '%ryan%';
    `));
});