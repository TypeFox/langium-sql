grammar Sql

entry SqlFile:
    statements+=Statement*
    ;

Statement:
    TableDefinition | SelectStatement;


//DEFINITION/////////////////////////////////////////////////////////
TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier dataType=Type;
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
    | CastExpression
    ;

CastExpression:
    'CAST' '(' expr=Expression 'AS' type=Type ')'
    ;

ColumnName:
    column=[ColumnDefinition:Identifier];

Identifier returns string:
    ID | QUOTE_ID;

Numeric: value=NUMBER;

Type infers Type: 
    {infer BooleanType} 'BOOLEAN'
    //@see https://crate.io/docs/sql-99/en/latest//chapters/03.html
    | {infer SmallIntType} 'SMALLINT'
    | {infer IntegerType} ('INTEGER'|'INT')
    | {infer NumericType} 'NUMERIC' ('(' precision=IntegerLiteral (',' scale=IntegerLiteral)? ')')?
    | {infer FloatType} 'FLOAT' ('(' precision=IntegerLiteral ')')?
    | {infer DecimalType} ('DECIMAL'|'DEC') ('(' precision=IntegerLiteral (',' scale=IntegerLiteral)? ')')?
    | {infer RealType} 'REAL'
    | {infer DoublePrecisionType} 'DOUBLE' 'PRECISION'
    ; 
IntegerLiteral: value=NUMBER;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;
terminal NUMBER returns number: /\d+(\.\d+([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
