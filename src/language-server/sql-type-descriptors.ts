/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export type NumberishTypeDescriptorDiscriminator =
  | "smallint"
  | "integer"
  | "numeric"
  | "float"
  | "decimal"
  | "real"
  | "double";

export type TypeDescriptorDiscriminator =
  | "boolean"
  | NumberishTypeDescriptorDiscriminator;

export function isTypeABoolean(
  type: TypeDescriptor
): type is BooleanTypeDesciptor {
  return type.discriminator === 'boolean';
}

export function isTypeANumber(
  type: TypeDescriptor
): type is NumberishTypeDescriptor {
  return [
    "smallint",
    "integer",
    "numeric",
    "float",
    "decimal",
    "real",
    "double",
  ].includes(type.discriminator);
}

export interface TypeDescriptorBase {
  discriminator: TypeDescriptorDiscriminator;
}

export interface ParameterlessNumericTypedescriptor extends TypeDescriptorBase {
  discriminator: "smallint" | "integer" | "real" | "double";
}

export interface PreciseNumericTypeDescriptor extends TypeDescriptorBase {
  discriminator: "float";
  precision: number;
}

export interface ScaledNumericTypeDescriptor extends TypeDescriptorBase {
  discriminator: "numeric" | "decimal";
  precision: number;
  scale: number;
}

export interface BooleanTypeDesciptor extends TypeDescriptorBase {
  discriminator: "boolean";
}

export type NumberishTypeDescriptor =
  | ParameterlessNumericTypedescriptor
  | ScaledNumericTypeDescriptor
  | PreciseNumericTypeDescriptor;
export type TypeDescriptor = BooleanTypeDesciptor | NumberishTypeDescriptor;
