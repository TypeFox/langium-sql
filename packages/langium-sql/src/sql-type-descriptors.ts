/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from "lodash";

export type NumberTypeDescriptorDiscriminator =
    | "integer"
    | "real"
    ;

export type TypeDescriptorDiscriminator =
    | "boolean"
    | NumberTypeDescriptorDiscriminator
    | "text"
    | "row"
    | 'enum'
    | 'datetime'
    | 'null'
    | 'array'
    | 'blob'
    ;

export function isTypeANull(
    type: TypeDescriptor
): type is NullTypeDescriptor {
    return type.discriminator === "null";
}

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

export function isTypeADateTime(
    type: TypeDescriptor
): type is DateTimeTypeDescriptor {
    return type.discriminator === "datetime";
}

export function isTypeAnInteger(
    type: TypeDescriptor
): type is IntegerTypeDescriptor {
    return type.discriminator === "integer";
}

export function isTypeARow(
    type: TypeDescriptor
): type is IntegerTypeDescriptor {
    return type.discriminator === "row";
}

export function isTypeAnEnum(
    type: TypeDescriptor
): type is EnumTypeDescriptor {
    return type.discriminator === "enum";
}
export function isTypeABlob(
    type: TypeDescriptor
): type is BlobTypeDescriptor {
    return type.discriminator === "blob";
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

export interface RowTypeDescriptor extends TypeDescriptorBase {
    discriminator: "row";
    columnTypes: ColumnTypeDescriptor[];
}

export interface ColumnTypeDescriptor {
    name: string|undefined;
    type: TypeDescriptor;
}

export interface RealTypeDescriptor extends TypeDescriptorBase {
    discriminator: "real";
}

export interface EnumTypeDescriptor extends TypeDescriptorBase {
    discriminator: "enum";
    members: string[];
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

export interface NullTypeDescriptor extends TypeDescriptorBase {
    discriminator: "null";
}

export interface ArrayTypeDescriptor extends TypeDescriptorBase {
    discriminator: "array";
    elementType: TypeDescriptor;
}

export interface DateTimeTypeDescriptor extends TypeDescriptorBase {
    discriminator: "datetime";
}

export interface BlobTypeDescriptor extends TypeDescriptorBase {
    discriminator: "blob";
}

export type TextualTypeDescriptor = CharTypeDescriptor;
export type NumberTypeDescriptor = IntegerTypeDescriptor|RealTypeDescriptor;
export type TypeDescriptor = BlobTypeDescriptor | ArrayTypeDescriptor | NullTypeDescriptor | BooleanTypeDesciptor | NumberTypeDescriptor | TextualTypeDescriptor | RowTypeDescriptor | EnumTypeDescriptor | DateTimeTypeDescriptor;

export const Types = {
    Null: {
        discriminator: 'null',
    } as NullTypeDescriptor,
    ArrayOf(elementType: TypeDescriptor) {
        return {
            discriminator: 'array',
            elementType
        } as TypeDescriptor;
    },
    Boolean: {
        discriminator: 'boolean'
    } as TypeDescriptor,
    Blob: {
        discriminator: 'blob'
    } as TypeDescriptor,
    Integer: {
        discriminator: 'integer'
    } as TypeDescriptor,
    Real: {
        discriminator: 'real'
    } as TypeDescriptor,
    DateTime: {
        discriminator: 'datetime'
    } as TypeDescriptor,
    Char(length: number = 100): TypeDescriptor { //TODO find proper default value
        return {
            discriminator: 'text',
            length
        };
    },
    Enum(members: string[]): TypeDescriptor {
        return {discriminator: 'enum', members};
    }
}

export function areTypesEqual(lhs: TypeDescriptor, rhs: TypeDescriptor): boolean {
    return _.isEqual(lhs, rhs);
}