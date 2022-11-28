/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import { SelectQuery, SqlAstType } from './generated/ast';
import type { SqlServices } from './sql-module';

/**
 * Registry for validation checks.
 */
export class SqlValidationRegistry extends ValidationRegistry {
    constructor(services: SqlServices) {
        super(services);
        const validator = services.validation.SqlValidator;
        const checks: ValidationChecks<SqlAstType> = {
            SelectQuery: validator.checkSelectQuery
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
export class SqlValidator {

    checkSelectQuery(query: SelectQuery, accept: ValidationAcceptor): void {
        if (query.table?.ref && query.columns.length === 0 && !query.wildcard) {
            accept('error', 'Query must specify at least one output column.', { node: query })
        }
    }

}
