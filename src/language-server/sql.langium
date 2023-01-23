grammar Sql

entry SqlFile:
    statements+=Statement*;

Statement:
    TableDefinition | SelectStatement | TypeDefinition;


//DEFINITION/////////////////////////////////////////////////////////
TypeDefinition:
    'CREATE' 'TYPE' name=TypeName '(' 
       (properties+=TypeProperty (',' properties+=TypeProperty)*)?
    ')' ';'
    ;

TypeName returns string:
    Identifier+
    ;

TypeProperty:
    name=Identifier type=TypeCall ('=' defaultValue=Expression)?
    ;

TypeCall:
    type=[TypeDefinition:TypeName] ('(' 
        values+=Expression (',' values+=Expression)*
    ')')?
    ;

TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier dataType=[TypeDefinition:TypeName];
//END DEFINITION/////////////////////////////////////////////////////////

SelectStatement:
    'SELECT'
    select=SelectElements
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
    | {infer AllTable}variableName=TableVariableName '.' '*'
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

TableVariableName:
    variable=[TableSourceItem:Identifier]
    ;

TableName: table=[TableDefinition:Identifier];

Expression:
    ColumnName
    | {infer TableRelatedColumn}variableName=TableVariableName '.' columnName=ColumnName
    | Numeric
    ;

ColumnName:
    column=[ColumnDefinition:Identifier];

Identifier returns string:
    ID | QUOTE_ID;

Numeric: value=NUMBER;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;
terminal NUMBER returns number: /\d+(\.\d+([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
