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
import { computeType, computeTypeOfSelectStatement } from "./sql-type-computation";
import { isTypeABoolean } from "./sql-type-descriptors";
import { getColumnsForSelectTableExpression, getDefinitionType, getDefinitionTypeName } from "./sql-type-utilities";
import { canConvert } from "./sql-type-conversion";

export class SqlValidationRegistry extends ValidationRegistry {
    constructor(services: SqlServices) {
        super(services);
        const validator = services.validation.SqlValidator;
        const checks: ValidationChecks<ast.SqlAstType> = {
            TableDefinition: [validator.checkIfTableDefinitionHasAtLeastOneColumn],
            SimpleSelectStatement: [
                validator.checkVariableNamesAreUnique,
                validator.checkIfSelectStatementWithAllStarSelectItemHasAtLeastOneTableSource
            ],
            //Expression: [validator.checkIfExpressionHasType], //TODO uncomment when type system is bullet-proof
            BinaryTableExpression: [validator.checkBinaryTableExpressionMatches],
            NumberLiteral: [validator.checkIntegerLiteralIsWholeNumber],
            BinaryExpression: [validator.checkBinaryExpressionType],
            UnaryExpression: [validator.checkUnaryExpressionType],
            WhereClause: [validator.checkWhereIsBoolean],
            HavingClause: [validator.checkHavingIsBoolean],
            SubQueryExpression: [validator.checkIfSubQuerySelectsExactlyOneValue],
            ReferenceDefinition: [validator.checkIfReferencePointsToCorrectParent],
            FunctionCall: [validator.checkFunctionCallTarget],
            TableSourceItem: [validator.checkTableSourceItemTarget],
            ConstraintDefinition: [validator.checkConstraintTarget]
        };
        this.register(checks, validator);
    }
}

export class SqlValidator {

    checkBinaryTableExpressionMatches(expr: ast.BinaryTableExpression, accept: ValidationAcceptor) {
        const lhs = getColumnsForSelectTableExpression(expr.left);
        const rhs = getColumnsForSelectTableExpression(expr.right);
        if(lhs.length !== rhs.length) {
            ReportAs.TableOperationUsesTablesWithDifferentColumnCounts(expr, {}, accept);
        } else {
            lhs.forEach((left, index) => {
                const right = rhs[index];
                const leftType = computeType(left.typedNode);
                const rightType = computeType(right.typedNode);
                if(leftType && rightType) {
                    if(!canConvert(leftType, rightType) && !canConvert(rightType, leftType)) {
                        ReportAs.TableOperationUsesTablesWithDifferentColumnTypes(expr, {columnIndex: index}, accept);
                    }
                } //else should be handled by different validator
            });
        }
    }

    checkIfExpressionHasType(expr: ast.Expression, accept: ValidationAcceptor): void {
        const type = computeType(expr);
        if(!type) {
           ReportAs.CannotDeriveTypeOfExpression(expr, {}, accept);
       }
    }

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
        query: ast.SimpleSelectStatement,
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
        literal: ast.NumberLiteral,
        accept: ValidationAcceptor
    ): void {
        // if (Math.floor(literal.value) !== literal.value) {
        //     ReportAs.NumericValueIsNotInteger(
        //         literal,
        //         { value: literal.value },
        //         accept
        //     );
        // }
    }

    checkIfSelectStatementWithAllStarSelectItemHasAtLeastOneTableSource(selectStatement: ast.SimpleSelectStatement, accept: ValidationAcceptor): void {
        if(selectStatement.select.elements.filter(ast.isAllStar).length > 0) {
            if(!selectStatement.from) {
                ReportAs.AllStarSelectionRequiresTableSources(selectStatement, {}, accept);
            }
        }
    }

    checkIfTableDefinitionHasAtLeastOneColumn(tableDefinition: ast.TableDefinition, accept: ValidationAcceptor): void {
        if(tableDefinition.columns.length === 0) {
            ReportAs.TableDefinitionRequiresAtLeastOneColumn(tableDefinition.reference, {}, accept);
        }
    }

    checkIfReferencePointsToCorrectParent(referenceDefinition: ast.ReferenceDefinition, accept: ValidationAcceptor): void {
        this.checkReferenceParent(referenceDefinition.reference, accept);
    }

    protected checkReferenceParent(globalReference: ast.GlobalReference, accept: ValidationAcceptor): void {
        const element = globalReference?.element?.ref;
        if (element) {
            const parent = globalReference.previous?.element?.ref;
            if (parent) {
                const ownType = getDefinitionType(element);
                const parentType = getDefinitionType(parent);
                if (parentType >= ownType) {
                    accept('error', `Cannot nest element of type '${getDefinitionTypeName(element)}' inside of '${getDefinitionTypeName(parent)}'`, {
                        node: globalReference,
                        property: 'previous'
                    });
                } else if (globalReference.previous) {
                    this.checkReferenceParent(globalReference.previous, accept);
                }
            }
        }
    }

    //TODO does not hold for insertions! INSERT INTO employees SELECT id, name FROM xxx
    checkIfSubQuerySelectsExactlyOneValue(subQueryExpression: ast.SubQueryExpression, accept: ValidationAcceptor) {
        const type = computeTypeOfSelectStatement(subQueryExpression.subQuery);
        if(type.discriminator === 'row' && type.columnTypes.length > 1) {
            ReportAs.SubQueriesWithinSelectStatementsMustHaveExactlyOneColumn(subQueryExpression, {}, accept);
        }
    }

    checkFunctionCallTarget(functionCall: ast.FunctionCall, accept: ValidationAcceptor) {
        const reference = functionCall.function?.element?.ref;
        if (reference && !ast.isFunctionDefinition(reference)) {
            ReportAs.IncorrectGlobalReferenceTarget(functionCall.function, {
                expected: 'FUNCTION',
                received: getDefinitionTypeName(reference)
            }, accept);
        }
    }

    checkTableSourceItemTarget(tableSourceItem: ast.TableSourceItem, accept: ValidationAcceptor) {
        const reference = tableSourceItem.table?.element?.ref;
        if (reference && !ast.isTableLike(reference)) {
            ReportAs.IncorrectGlobalReferenceTarget(tableSourceItem.table, {
                expected: 'TABLE',
                received: getDefinitionTypeName(reference)
            }, accept);
        }
    }

    checkConstraintTarget(constraintDefinition: ast.ConstraintDefinition, accept: ValidationAcceptor) {
        const reference = constraintDefinition.table?.element?.ref;
        if (reference && !ast.isTableDefinition(reference)) {
            ReportAs.IncorrectGlobalReferenceTarget(constraintDefinition.table, {
                expected: 'TABLE',
                received: getDefinitionTypeName(reference)
            }, accept);
        }
    }
}
