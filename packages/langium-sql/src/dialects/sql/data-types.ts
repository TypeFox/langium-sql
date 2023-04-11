/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DialectTypeList } from "../../sql-data-types";

export const SqlDialectTypes: DialectTypeList<string> = {
    strings: ['TEXT'],
    integers: ['INTEGER', 'INT'],
    reals: ['REAL'],
    booleans: ['BOOLEAN', 'BOOL'],
    blobs: ['BLOB'],
    enums: [],
    dateTimes: ['DATETIME'],
};