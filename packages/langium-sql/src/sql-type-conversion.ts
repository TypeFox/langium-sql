/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { TypeDescriptor, TypeDescriptorDiscriminator } from "./sql-type-descriptors";
import { Value } from "./sql-type-values";

export type TypeConversionKind = 'implicit'|'explicit';
type TypeConvertFunction = (value: Value) => Value;

export interface TypeConverter {
    kind: TypeConversionKind;
    convert: TypeConvertFunction;
}
export type TypeConversionPair = `${TypeDescriptorDiscriminator}->${TypeDescriptorDiscriminator}`;

const Identity: TypeConverter = {kind: "implicit", convert: (v) => v};
function Implicit(convert: (value: Value) => Value): TypeConverter {
    return {kind: 'implicit', convert};
}
function Explicit(convert: (value: Value) => Value): TypeConverter {
    return {kind: 'explicit', convert};
}
const Forbidden: TypeConverter|undefined = undefined;
const ConversionTable: Record<TypeConversionPair, TypeConverter|undefined> = {
    "boolean->boolean": Identity,
    "boolean->integer": Implicit(v => {
        return {
            type: "integer",
            value: BigInt(v.value ? 1 : 0)
        };
    }),
    "boolean->real": Implicit(v => {
        return {
            type: "real",
            value: v.value ? 1 : 0
        };
    }),
    "boolean->text": Implicit(v => {
        return {
            type: "text",
            value: v.value ? 'TRUE' : 'FALSE'
        };
    }),
    "integer->boolean": Explicit(v => {
        return {
            type: "boolean",
            value: v.value !== BigInt(0)
        };
    }),
    "integer->integer": Identity,
    "integer->real": Implicit(v => {
        return {
            type: "real",
            value: Number(v.value)
        };
    }),
    "integer->text": Implicit(v => {
        return {
            type: "text",
            value: v.value.toString()
        };
    }),
    "real->boolean": Explicit(v => {
        return {
            type: "boolean",
            value: v.value !== 0
        };
    }),
    "real->integer": Explicit(v => {
        return {
            type: "integer",
            value: BigInt(v.value)
        };
    }),
    "real->real": Identity,
    "real->text": Explicit(v => {
        return {
            type: "text",
            value: v.value.toString()
        };
    }),
    "text->boolean": Explicit(v => {
        if (typeof v.value !== 'string') {
            throw new Error();
        }
        return {
            type: "boolean",
            value: v.value.length > 0
        };
    }),
    "text->integer": Explicit(v => {
        return {
            type: "integer",
            value: BigInt(v.value)
        };
    }),
    "text->real": Explicit(v => {
        if (typeof v.value !== 'string') {
            throw new Error();
        }
        return {
            type: "real",
            value: parseFloat(v.value)
        };
    }),
    "text->text": Identity,
    "boolean->row": Forbidden,
    "text->row": Forbidden,
    "row->boolean": Forbidden,
    "row->text": Forbidden,
    "row->row": Identity,
    "row->integer": Forbidden,
    "row->real": Forbidden,
    "integer->row": Forbidden,
    "real->row": Forbidden,

    "boolean->enum": Forbidden,
    "row->enum": Forbidden,
    "text->enum": Forbidden,
    "enum->boolean": Forbidden,
    "enum->row": Forbidden,
    "enum->text": Forbidden,
    "enum->enum": Identity,
    "enum->integer": Forbidden,
    "enum->real": Forbidden,
    "integer->enum": Forbidden,
    "real->enum": Forbidden,

    "boolean->datetime": Forbidden,
    "row->datetime": Forbidden,
    "text->datetime": Forbidden,
    "enum->datetime": Forbidden,
    "datetime->boolean": Forbidden,
    "datetime->row": Forbidden,
    "datetime->text": Forbidden,
    "datetime->enum": Forbidden,
    "datetime->datetime": Identity,
    "datetime->integer": Forbidden,
    "datetime->real": Forbidden,
    "integer->datetime": Forbidden,
    "real->datetime": Forbidden,

    "boolean->null": Forbidden,
    "row->null": Forbidden,
    "enum->null": Forbidden,
    "text->null": Forbidden,
    "null->boolean": Forbidden,
    "null->row": Forbidden,
    "null->enum": Forbidden,
    "null->text": Forbidden,
    "null->null": Identity,
    "null->datetime": Forbidden,
    "null->real": Forbidden,
    "null->integer": Forbidden,
    "datetime->null": Forbidden,
    "real->null": Forbidden,
    "integer->null": Forbidden,

    "boolean->array": Forbidden,
    "datetime->array": Forbidden,
    "array->boolean": Forbidden,
    "array->datetime": Forbidden,
    "array->array": Identity,
    "array->null": Forbidden,
    "array->text": Forbidden,
    "array->row": Forbidden,
    "array->enum": Forbidden,
    "array->integer": Forbidden,
    "array->real": Forbidden,
    "null->array": Forbidden,
    "text->array": Forbidden,
    "row->array": Forbidden,
    "enum->array": Forbidden,
    "integer->array": Forbidden,
    "real->array": Forbidden
};

export function getConvertFunction(source: TypeDescriptor, target: TypeDescriptor, kind: TypeConversionKind): TypeConvertFunction|null {
    const entry = ConversionTable[`${source.discriminator}->${target.discriminator}`];
    if(entry != null && (kind === "explicit" || entry.kind === 'implicit')) {
        return (v: Value) => entry.convert(v);
    } else {
        return null;
    }
}

export function canConvert(source: TypeDescriptor, target: TypeDescriptor, kind: TypeConversionKind = 'implicit'): boolean {
    const entry = ConversionTable[`${source.discriminator}->${target.discriminator}`];
    if(entry != null && (kind === "explicit" || entry.kind === 'implicit')) {
        return true;
    } else {
        return false;
    }
}