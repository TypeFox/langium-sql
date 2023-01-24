
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