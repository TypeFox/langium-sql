/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import assert from "assert";
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
        assert(v.type === 'boolean');
        return {
            type: "integer",
            value: BigInt(v.value ? 1 : 0)
        };
    }),
    "boolean->real": Implicit(v => {
        assert(v.type === 'boolean');
        return {
            type: "real",
            value: v.value ? 1 : 0
        };
    }),
    "boolean->text": Implicit(v => {
        assert(v.type === 'boolean');
        return {
            type: "text",
            value: v.value ? 'TRUE' : 'FALSE'
        };
    }),
    "integer->boolean": Explicit(v => {
        assert(v.type === 'integer');
        return {
            type: "boolean",
            value: v.value !== BigInt(0)
        };
    }),
    "integer->integer": Identity,
    "integer->real": Implicit(v => {
        assert(v.type === 'integer');
        return {
            type: "real",
            value: Number(v.value)
        };
    }),
    "integer->text": Implicit(v => {
        assert(v.type === 'integer');
        return {
            type: "text",
            value: v.value.toString()
        };
    }),
    "real->boolean": Explicit(v => {
        assert(v.type === 'real');
        return {
            type: "boolean",
            value: v.value !== 0
        };
    }),
    "real->integer": Explicit(v => {
        assert(v.type === 'real');
        return {
            type: "integer",
            value: BigInt(v.value)
        };
    }),
    "real->real": Identity,
    "real->text": Explicit(v => {
        assert(v.type === 'real');
        return {
            type: "text",
            value: v.value.toString()
        };
    }),
    "text->boolean": Explicit(v => {
        assert(v.type === 'text');
        return {
            type: "boolean",
            value: v.value.length > 0
        };
    }),
    "text->integer": Explicit(v => {
        assert(v.type === 'text');
        return {
            type: "integer",
            value: BigInt(v.value)
        };
    }),
    "text->real": Explicit(v => {
        assert(v.type === 'text');
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
    "real->row": Forbidden
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