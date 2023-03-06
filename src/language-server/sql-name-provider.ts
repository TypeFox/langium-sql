/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode, DefaultNameProvider, isNamed } from "langium";

export class SqlNameProvider extends DefaultNameProvider {
    override getName(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name.replace(/^\`|\`$/g, '').replace(/\\(.)/g, '$1');
        }
        return undefined;
    }
}