/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AST as ast } from "./index";
import { DatabaseDialect } from "./sql-databases";

type DataTypeList = Record<DatabaseDialect, string[]>;

function getName(dataType: string): string {
    const index = dataType.indexOf('(');
    if (index >= 0) {
        return dataType.substring(0, index).toUpperCase();
    } else {
        return dataType.toUpperCase();
    }
}

function distinct<T>(arr: T[]): T[] {
    return Array.from(new Set(arr));
}

export function isStringDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allStrings);
}

export function isIntegerDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allIntegers);
}

export function isRealDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allReals);
}

export function isDateTimeDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allDateTimes);
}

export function isBooleanDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allBooleans);
}

export function isBlobDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, allBlobs);
}

export function isEnumDataType(dataType: ast.DataType): boolean {
    return isDataType(dataType, ['ENUM']);
}

function isDataType(dataType: ast.DataType, values: string[]): boolean {
    const name = dataType.dataTypeNames.join(' ').toUpperCase();
    return values.includes(name);
}

export const STRINGS: DataTypeList = {
    SQL: [
        'TEXT'
    ],
    MySQL: [
        'CHAR(size?)',
        'VARCHAR(size)',
        'TINYTEXT',
        'TEXT(size)',
        'MEDIUMTEXT',
        'LONGTEXT'
    ],
    Oracle: [
        'VARCHAR2(size)',
        'NVARCHAR2(size)',
        'NCHAR(size)',
        'CLOB',
        'NCLOB',
    ],
    PostgreSQL: [
        'CHARACTER VARYING(size)',
        'VARCHAR(size)',
        'CHARACTER(n)',
        'CHAR(n)',
        'TEXT'
    ],
    Presto: [
        'CHAR',
        'VARCHAR'
    ],
    SQLServer: [
        'CHAR(size)',
        'VARCHAR(size)',
        'TEXT',
        'NCHAR',
        'NVARCHAR',
        'NTEXT'
    ]
};

export const INTEGERS: DataTypeList = {
    SQL: [
        'INT',
        'INTEGER'
    ],
    MySQL: [
        'BIT(size)',
        'TINYINT(size)',
        'SMALLINT(size)',
        'MEDIUMINT(size)',
        'INT(size)',
        'INTEGER(size)',
        'BIGINT(size)'
    ],
    Oracle: [],
    SQLServer: [
        'BIT',
        'TINYINT',
        'SMALLINT',
        'INT',
        'BIGINT'
    ],
    PostgreSQL: [],
    Presto: []
};

export const REALS: DataTypeList = {
    SQL: ['REAL'],
    Oracle: [
        'NUMBER(p?, s?)',
        'BINARY_FLOAT',
        'BINARY_DOUBLE'
    ],
    MySQL: [
        'DECIMAL(p?, s?)'
    ],
    PostgreSQL: [],
    Presto: [],
    SQLServer: [
        'REAL',
        'FLOAT(n?)',
        'DECIMAL(p?, s?)',
        'NUMERIC(p?, s?)',
        'SMALLMONEY',
        'MONEY'
    ]
};

export const BOOLEANS: DataTypeList = {
    SQL: ['BOOLEAN', 'BOOL'],
    MySQL: [],
    Oracle: [],
    PostgreSQL: [],
    Presto: [],
    SQLServer: []
};

export const BLOBS: DataTypeList = {
    SQL: ['BLOB'],
    MySQL: [
        'BINARY(size)',
        'VARBINARY(size)',
        'TINYBLOB',
        'BLOB(size)',
        'MEDIUMBLOB',
        'LONGBLOB'
    ],
    Oracle: [
        'RAW(size)',
        'LONG RAW',
        'BLOB',
        'BFILE'
    ],
    PostgreSQL: [],
    Presto: [],
    SQLServer: [
        'BINARY(n)',
        'VARBINARY',
        'IMAGE'
    ]
};

export const DATETIMES: DataTypeList = {
    SQL: ['DATETIME'],
    MySQL: [
        'DATE',
        'DATETIME(fsp?)',
        'TIMESTAMP(fsp?)',
        'TIME(fsp?)',
        'YEAR'
    ],
    SQLServer: [
        'DATETIME',
        'DATETIME2',
        'SMALLDATETIME',
        'DATE',
        'TIME',
        'DATETIMEOFFSET',
        'TIMESTAMP'
    ],
    Oracle: [
        'TIMESTAMP(fsp?)',
        'TIMESTAMP(fsp?) WITH TIME ZONE',
        'TIMESTAMP(fsp?) WITH LOCAL TIME ZONE',
        'INTERVAL YEAR(p?) TO MONTH',
        'INTERVAL DAY(p?) TO SECOND'
    ],
    PostgreSQL: [],
    Presto: []
};

const allStrings = all(STRINGS);
const allIntegers = all(INTEGERS);
const allReals = all(REALS);
const allDateTimes = all(DATETIMES);
const allBlobs = all(BLOBS);
const allBooleans = all(BOOLEANS);

function all(list: DataTypeList): string[] {
    return distinct(Object.values(list).flat().map(getName));
}
