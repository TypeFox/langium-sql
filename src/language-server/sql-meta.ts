export type SqlTypeDefinitions = Record<string, SqlTypeDefinition>;
export interface SqlTypeDefinition {}

export type SqlColumnDefinitions = Record<string, SqlColumnDefinition>;
export interface SqlColumnDefinition {
    dataTypeName: string;
}

export type SqlTableDefinitions = Record<string, SqlColumnDefinitions>;