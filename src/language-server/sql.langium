grammar Sql

entry SqlFile:
    statements+=Statement*;

Statement:
    TableDefinition | SelectQuery | TypeDefinition;

TypeDefinition:
    'CREATE' 'TYPE' name=Identifier ';'
    ;

TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier dataType=[TypeDefinition:Identifier];

SelectQuery:
    'SELECT' (
        columns+=Expression (',' columns+=Expression)* trailingComma?=','?
        | wildcard='*'
    )? 'FROM' table=[TableDefinition:Identifier] ';';

Expression:
    ColumnReference;

ColumnReference:
    column=[ColumnDefinition:Identifier];

Identifier returns string:
    ID | QUOTE_ID;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
