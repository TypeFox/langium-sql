/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { GrammarAST, CstNode, DefaultValueConverter, ValueType } from "langium";

export class SqlValueConverter extends DefaultValueConverter {
    protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
        if(rule.name.toUpperCase() === 'TICK_STRING' || rule.name.toUpperCase() === 'STRING') {
            return input.substring(1, input.length-1).replace(/\\(.)/g, '$1');
        }
        return super.runConverter(rule, input, cstNode);
    }
}