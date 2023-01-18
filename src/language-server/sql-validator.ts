/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks, ValidationRegistry } from 'langium';
import * as ast from './generated/ast';
import _ from 'lodash';
import type { SqlServices } from './sql-module';
import { ReportAs } from './sql-error-codes';

/**
 * Registry for validation checks.
 */
export class SqlValidationRegistry extends ValidationRegistry {
    constructor(services: SqlServices) {
        super(services);
        const validator = services.validation.SqlValidator;
        const checks: ValidationChecks<ast.SqlAstType> = {
            SelectStatement: [validator.checkVariableNamesAreUnique]
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
export class SqlValidator {
    checkVariableNamesAreUnique(query: ast.SelectStatement, accept: ValidationAcceptor): void {
        const groups = _.groupBy(query.from?.sources.list, s => s.item.name);
        for (const [key, group] of Object.entries(groups).filter(g => g[0] && g[1].length > 1)) {
            for (const member of group) {
                ReportAs.DuplicatedVariableName(member.item, {name: key}, accept)
            }
        }
    }
}
