/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, DiagnosticInfo, ValidationAcceptor } from "langium";
import * as ast from "./generated/ast";
import { TypeDescriptor } from "./sql-type-descriptors";
import { BinaryOperator, UnaryOperator } from "./sql-type-operators";

type SqlErrorSeverity = "error" | "warning" | "info" | "hint";

class SqlErrorFactory {
    static create<T extends AstNode, P>(
        code: string,
        severity: SqlErrorSeverity,
        messageGenerator: (props: P) => string,
        diagnosticGenerator: (node: T) => DiagnosticInfo<T>
    ): SqlErrorReporter<T, P> {
        const reporter = <SqlErrorReporter<T, P>>((
            node: T,
            props: P,
            accept: ValidationAcceptor
        ) => {
            accept(
                severity,
                messageGenerator(props),
                ((node) => {
                    const info = diagnosticGenerator(node);
                    info.code = code;
                    return info;
                })(node)
            );
        });
        reporter.Code = code;
        return reporter;
    }
}

type SqlErrorReporter<T extends AstNode, P> = {
    (node: T, props: P, accept: ValidationAcceptor): void;
    Code: string;
};

interface Nameable {
    name: string;
}

interface NumericValue {
    value: number;
}

export const ReportAs = {
    DuplicatedVariableName: SqlErrorFactory.create<
        ast.SourceItem,
        Nameable
    >(
        "SQL00001",
        "error",
        ({ name }) => `Duplicated variable name '${name}'.`,
        (node) => ({ node, property: "name" })
    ),
    NumericValueIsNotInteger: SqlErrorFactory.create<
        ast.IntegerLiteral,
        NumericValue
    >(
        "SQL00002",
        "error",
        ({ value }) => `Value '${value}' is not an integer.`,
        (node) => ({ node, property: "value" })
    ),
    BinaryOperatorNotDefinedForGivenExpressions: SqlErrorFactory.create<
        ast.BinaryExpression,
        BinaryOperatorMismatch
    >(
        "SQL00003",
        "error",
        ({ op, left, right }) =>
            `Binary operator '${op}' is not defined for ('${left.discriminator}', '${right.discriminator}').`,
        (node) => ({ node, property: "operator" })
    ),
    UnaryOperatorNotDefinedForGivenExpression: SqlErrorFactory.create<
        ast.UnaryExpression,
        UnaryOperatorMismatch
    >(
        "SQL00004",
        "error",
        ({ op, operand }) =>
            `Unary operator '${op}' is not defined for '${operand.discriminator}'.`,
        (node) => ({ node, property: "operator" })
    ),
    ExpressionMustReturnABoolean: SqlErrorFactory.create<
        ast.Expression,
        TypeDescriptor
    >(
        "SQL00005",
        "error",
        (operand) =>
            `Expression must return a boolean, not a '${operand.discriminator}'.`,
        (node) => ({ node })
    ),
    AllStarSelectionRequiresTableSources: SqlErrorFactory.create<
        ast.SimpleSelectStatement,
        {}
    >(
        "SQL00006",
        "error",
        () => `All-star selection requires table sources (FROM is missing).`,
        (node) => ({ node })
    ),
    TableDefinitionRequiresAtLeastOneColumn: SqlErrorFactory.create<
        ast.TableDefinition,
        {}
    >(
        "SQL00007",
        "error",
        () => `Table definition requires at least one column.`,
        (node) => ({ node, property: "name" })
    ),
    SubQueriesWithinSelectStatementsMustHaveExactlyOneColumn:
        SqlErrorFactory.create<ast.SubQueryExpression, {}>(
            "SQL00008",
            "error",
            () =>
                `Sub queries within select statements must have exactly one column.`,
            (node) => ({ node, property: "subQuery" })
        ),
    CannotDeriveTypeOfExpression:
        SqlErrorFactory.create<ast.Expression, {}>(
            "SQL00009",
            "error",
            () =>
                `Unable to derive the type of the expression.`,
            (node) => ({ node })
        ),
};

export interface BinaryOperatorMismatch {
    op: BinaryOperator;
    left: TypeDescriptor;
    right: TypeDescriptor;
}

export interface UnaryOperatorMismatch {
    op: UnaryOperator;
    operand: TypeDescriptor;
}
