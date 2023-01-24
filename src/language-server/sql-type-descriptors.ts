/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export type TypeDescriptorDiscriminator = 
  | 'boolean'
  | 'smallint'
  | 'integer'
  | 'numeric'
  | 'float'
  | 'decimal'
  | 'real'
  | 'double'
  ;

export interface TypeDescriptorBase {
  discriminator: TypeDescriptorDiscriminator;
}

export interface ParameterlessNumericTypedescriptor extends TypeDescriptorBase {
  discriminator: 'smallint'|'integer'|'real'|'double';
}

export interface PreciseNumericTypedescriptor extends TypeDescriptorBase {
  discriminator: 'float';
  precision: number;
}

export interface ScaledNumericTypedescriptor extends TypeDescriptorBase {
  discriminator: 'numeric'|'decimal';
  precision: number;
  scale: number;
}

export interface BooleanTypeDesciptor extends TypeDescriptorBase { 
  discriminator: 'boolean';
}
export type TypeDescriptor = BooleanTypeDesciptor
| ParameterlessNumericTypedescriptor
| ScaledNumericTypedescriptor
| PreciseNumericTypedescriptor
;