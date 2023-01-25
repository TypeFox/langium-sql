/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, DiagnosticInfo, ValidationAcceptor } from "langium";
import * as ast from "./generated/ast";

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
        ast.TableSourceItem,
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
};
