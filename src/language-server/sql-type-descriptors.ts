/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export type NumberTypeDescriptorDiscriminator =
    | "integer"
    | "real"
    ;

export type TypeDescriptorDiscriminator =
    | "boolean"
    | NumberTypeDescriptorDiscriminator
    | "text"
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
): type is RealTypeDescriptor {
    return type.discriminator === "real";
}

export function isTypeAnInteger(
    type: TypeDescriptor
): type is IntegerTypeDescriptor {
    return type.discriminator === "integer";
}

export function isTypeAText(
    type: TypeDescriptor
): type is CharTypeDescriptor {
    return [
        "text",
    ].includes(type.discriminator);
}

export interface TypeDescriptorBase {
    discriminator: TypeDescriptorDiscriminator;
}

export interface RealTypeDescriptor extends TypeDescriptorBase {
    discriminator: "real";
}

export interface IntegerTypeDescriptor extends TypeDescriptorBase {
    discriminator: "integer";
}

export interface BooleanTypeDesciptor extends TypeDescriptorBase {
    discriminator: "boolean";
}

export interface CharTypeDescriptor extends TypeDescriptorBase {
    discriminator: "text";
    length: number;
}

export type TextualTypeDescriptor = CharTypeDescriptor;
export type NumberTypeDescriptor = IntegerTypeDescriptor|RealTypeDescriptor;
export type TypeDescriptor = BooleanTypeDesciptor | NumberTypeDescriptor | TextualTypeDescriptor;

export const Types = {
    Boolean: {
        discriminator: 'boolean'
    } as TypeDescriptor,
    Integer: {
        discriminator: 'integer'
    } as TypeDescriptor,
    Real: {
        discriminator: 'real'
    } as TypeDescriptor,
    Char(length: number = 100): TypeDescriptor { //TODO find proper default value
        return {
            discriminator: 'text',
            length
        };
    }
}