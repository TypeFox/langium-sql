/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TypeDescriptorDiscriminator } from "./sql-type-descriptors.js";

export interface ValueBase {
    type: TypeDescriptorDiscriminator;
}

export interface BooleanValue extends ValueBase {
    type: "boolean";
    value: boolean;
}

export interface IntegerValue extends ValueBase {
    type: "integer";
    value: bigint;
}

export interface RealValue extends ValueBase {
    type: "real";
    value: number;
}

export interface TextValue extends ValueBase {
    type: "text";
    value: string;
}

export type Value = TextValue | RealValue | IntegerValue | BooleanValue;
