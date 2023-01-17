grammar Sql

entry SqlFile:
    statements+=Statement*;

Statement:
    TableDefinition | SelectStatement | TypeDefinition;


//DEFINITION/////////////////////////////////////////////////////////
TypeDefinition:
    'CREATE' 'TYPE' name=Identifier ';'
    ;

TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier dataType=[TypeDefinition:Identifier];
//END DEFINITION/////////////////////////////////////////////////////////

SelectStatement:
    'SELECT'
    selects=SelectElements
    from=FromClause? 
    //groupBy=GroupByClause?
    //having=HavingClause?
    //orderBy=OrderByClause?
    //limit=LimitClause? 
    ';';

SelectElements:
    elements+=SelectElement (',' elements+=SelectElement)*
    ;
    
SelectElement:
    {infer AllStar}'*'
    | {infer AllTable}name=TableName '.' '*'
    | Expression
    ;
    
FromClause: 'FROM' sources=TableSources;

TableSources: list+=TableSource (',' list+=TableSource)*;

TableSource:
    item=TableSourceItem joins+=JoinPart*
    ;

JoinPart:
    'JOIN' nextItem=TableSourceItem ('ON' joinOn=Expression)?
    ;

TableSourceItem
    : tableName=TableName ('AS'? name=Identifier)?
    ;

TableName: table=[TableDefinition:Identifier];

Expression:
    ColumnName;

ColumnName:
    column=[ColumnDefinition:Identifier];

Identifier returns string:
    ID | QUOTE_ID;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
