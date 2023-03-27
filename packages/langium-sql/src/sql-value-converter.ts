/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CstNode, DefaultValueConverter, ValueType } from "langium";
import { AbstractRule } from "langium/lib/grammar/generated/ast";

export class SqlValueConverter extends DefaultValueConverter {
    protected override runConverter(rule: AbstractRule, input: string, cstNode: CstNode): ValueType {
        if(rule.name.toUpperCase() === 'TICK_STRING') {
            return input.substring(1, input.length-1).replace(/\\(.)/g, '$1');
        }
        return super.runConverter(rule, input, cstNode);
    }
}