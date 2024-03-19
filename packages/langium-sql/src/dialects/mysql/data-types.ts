/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DialectTypeList, typesExtend } from "../../sql-data-types.js";
import { SqlServerDialectTypes } from "../sql-server/data-types.js";

export const MySqlDialectTypes: DialectTypeList<string> = typesExtend(SqlServerDialectTypes, {
    strings: [
        'CHAR(size?)',
        'VARCHAR(size)',
        'TINYTEXT',
        'TEXT(size)',
        'MEDIUMTEXT',
        'LONGTEXT'
    ],
    integers: [
        'BIT(size)',
        'TINYINT(size)',
        'SMALLINT(size)',
        'MEDIUMINT(size)',
        'INT(size)',
        'INTEGER(size)',
        'BIGINT(size)'
    ],
    reals: [
        'DECIMAL(size?, size?)'
    ],
    dateTimes: [
        'DATE',
        'DATETIME(size?)',
        'TIMESTAMP(size?)',
        'TIME(size?)',
        'YEAR'
    ],
    booleans: [],
    blobs: [
        'BINARY(size)',
        'VARBINARY(size)',
        'TINYBLOB',
        'BLOB(size)',
        'MEDIUMBLOB',
        'LONGBLOB'
    ],
    enums: []
});