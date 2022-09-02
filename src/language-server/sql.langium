grammar Sql

entry SqlFile:
    statements+=Statement*;

Statement:
    TableDefinition | SelectQuery;

TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier type=DataType;

SelectQuery:
    'SELECT' (
        columns+=Expression (',' columns+=Expression)* trailingComma?=','?
        | wildcard='*'
    )? 'FROM' table=[TableDefinition:Identifier] ';';

Expression:
    ColumnReference;

ColumnReference:
    column=[ColumnDefinition:Identifier];

DataType:
    BooleanDataType | IntegerDataType | StringDataType;

BooleanDataType:
    {infer BooleanDataType} 'boolean';

IntegerDataType:
    {infer IntegerDataType} 'integer';

StringDataType:
    (
        'character' varying?='varying'?
        | 'char'
        | varying?='varchar'
    )
    ('(' length=INT ')')?;

Identifier returns string:
    ID | QUOTE_ID;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;
terminal INT returns number: /[0-9]+/;
terminal STRING: /'[^']*'/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
