/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
    ValidationAcceptor,
    ValidationChecks,
    ValidationRegistry,
} from "langium";
import * as ast from "./generated/ast";
import _ from "lodash";
import type { SqlServices } from "./sql-module";
import { ReportAs } from "./sql-error-codes";
import { computeType } from "./sql-type-system";
import { isTypeABoolean } from "./sql-type-descriptors";

/**
 * Registry for validation checks.
 */
export class SqlValidationRegistry extends ValidationRegistry {
    constructor(services: SqlServices) {
        super(services);
        const validator = services.validation.SqlValidator;
        const checks: ValidationChecks<ast.SqlAstType> = {
            SelectStatement: [validator.checkVariableNamesAreUnique],
            IntegerLiteral: [validator.checkIntegerLiteralIsWholeNumber],
            BinaryExpression: [validator.checkBinaryExpressionType],
            UnaryExpression: [validator.checkUnaryExpressionType],
            WhereClause: [validator.checkWhereIsBoolean],
            HavingClause: [validator.checkHavingIsBoolean],
        };
        this.register(checks, validator);
    }
}

/**
 * Implementation of custom validations.
 */
export class SqlValidator {
    checkWhereIsBoolean(clause: ast.WhereClause, accept: ValidationAcceptor): void {
        const type = computeType(clause.rowCondition);
        if(type && !isTypeABoolean(type)) {
            ReportAs.ExpressionMustReturnABoolean(clause.rowCondition, type!, accept);
        }
    }
    checkHavingIsBoolean(clause: ast.HavingClause, accept: ValidationAcceptor): void {
        const type = computeType(clause.groupCondition);
        if(type && !isTypeABoolean(type)) {
            ReportAs.ExpressionMustReturnABoolean(clause.groupCondition, type!, accept);
        }
    }
    checkBinaryExpressionType(expr: ast.BinaryExpression, accept: ValidationAcceptor): void {
        const left = computeType(expr.left);
        const right = computeType(expr.right);
        const returnType = computeType(expr);
        if(left && right && !returnType) {
            ReportAs.BinaryOperatorNotDefinedForGivenExpressions(expr, {
                left,
                right,
                op: expr.operator
            }, accept);
        }
    }

    checkUnaryExpressionType(expr: ast.UnaryExpression, accept: ValidationAcceptor): void {
        const operand = computeType(expr.value);
        const returnType = computeType(expr);
        if(operand && !returnType) {
            ReportAs.UnaryOperatorNotDefinedForGivenExpression(expr, {
                operand,
                op: expr.operator
            }, accept);
        }
    }

    checkVariableNamesAreUnique(
        query: ast.SelectStatement,
        accept: ValidationAcceptor
    ): void {
        const groups = _.groupBy(query.from?.sources.list, (s) => s.item.name);
        for (const [key, group] of Object.entries(groups).filter(
            (g) => g[0] && g[1].length > 1
        )) {
            for (const member of group) {
                ReportAs.DuplicatedVariableName(
                    member.item,
                    { name: key },
                    accept
                );
            }
        }
    }

    checkIntegerLiteralIsWholeNumber(
        literal: ast.IntegerLiteral,
        accept: ValidationAcceptor
    ): void {
        if (Math.floor(literal.value) !== literal.value) {
            ReportAs.NumericValueIsNotInteger(
                literal,
                { value: literal.value },
                accept
            );
        }
    }
}
