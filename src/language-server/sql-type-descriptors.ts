/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export type NumberishTypeDescriptorDiscriminator =
    | "integer"
    | "real"
    ;

export type TypeDescriptorDiscriminator =
    | "boolean"
    | NumberishTypeDescriptorDiscriminator
    ;

export function isTypeABoolean(
    type: TypeDescriptor
): type is BooleanTypeDesciptor {
    return type.discriminator === "boolean";
}

export function isTypeANumber(
    type: TypeDescriptor
): type is NumberTypeDescriptor {
    return [
        "integer",
        "real",
    ].includes(type.discriminator);
}

export function isTypeAReal(
    type: TypeDescriptor
): type is RealTypedescriptor {
    return type.discriminator === "real";
}

export function isTypeAnInteger(
    type: TypeDescriptor
): type is IntegerTypedescriptor {
    return type.discriminator === "integer";
}


export interface TypeDescriptorBase {
    discriminator: TypeDescriptorDiscriminator;
}

export interface RealTypedescriptor extends TypeDescriptorBase {
    discriminator: "real";
}

export interface IntegerTypedescriptor extends TypeDescriptorBase {
    discriminator: "integer";
}

export interface BooleanTypeDesciptor extends TypeDescriptorBase {
    discriminator: "boolean";
}

export type NumberTypeDescriptor = IntegerTypedescriptor|RealTypedescriptor;
export type TypeDescriptor = BooleanTypeDesciptor | NumberTypeDescriptor;

export const Types: Record<string, TypeDescriptor> = {
    Boolean: {
        discriminator: 'boolean'
    },
    Integer: {
        discriminator: 'integer'
    },
    Real: {
        discriminator: 'real'
    }
}