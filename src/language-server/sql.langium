grammar Sql

entry SqlFile:
    statements+=Statement*
    ;

Statement:
    FunctionDefinition | TableDefinition | SelectStatement;


//DEFINITION/////////////////////////////////////////////////////////
TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=ColumnDefinition (',' columns+=ColumnDefinition)*
    )?')' ';';

ColumnDefinition:
    name=Identifier dataType=Type;

FunctionDefinition:
    'CREATE' 'FUNCTION' name=Identifier '('
        (params+=FormalParameterDefinition (',' params+=FormalParameterDefinition)*)?
    ')' 'AS' returnType=Type ';';

FormalParameterDefinition:
    name=Identifier dataType=Type
    ;
//END DEFINITION/////////////////////////////////////////////////////////

SelectStatement:
    'SELECT' ('ALL'|distinct?='DISTINCT')?
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

Expression: OrExpression;

OrExpression infers Expression:
    AndExpression ({infer BinaryExpression.left=current} operator='OR' right=AndExpression)*
    ;

AndExpression infers Expression:
    EqExpression ({infer BinaryExpression.left=current} operator='AND' right=EqExpression)*
    ;

EqExpression infers Expression:
    RelationalExpression ({infer BinaryExpression.left=current} operator=('='|'<>') right=RelationalExpression)*
    ;

RelationalExpression infers Expression:
    AdditiveExpression ({infer BinaryExpression.left=current} operator=('<='|'>='|'<'|'>') right=AdditiveExpression)*
    ;

AdditiveExpression infers Expression:
    MultiplicativeExpression ({infer BinaryExpression.left=current} operator=('+'|'-') right=MultiplicativeExpression)*
    ;

MultiplicativeExpression infers Expression:
    PrimaryExpression ({infer BinaryExpression.left=current} operator=('*'|'/'|'%') right=PrimaryExpression)*
    ;

PrimaryExpression infers Expression:
    ColumnName
    | {infer TableRelatedColumnExpression}variableName=TableVariableName '.' columnName=ColumnName
    | {infer NumericExpression} NumericExpression
    | {infer CastExpression} CastExpression
    | {infer UnaryExpression} operator=('NOT'|'-'|'+') value=PrimaryExpression
    | {infer ParenthesisExpression} '(' expression=Expression ')'
    | {infer FunctionCall} functionName=FunctionName '(' params=SelectElements? ')'
    ;

CastExpression:
    'CAST' '(' expr=Expression 'AS' type=Type ')'
    ;

FunctionName:
    function=[FunctionDefinition:Identifier]
    ;

ColumnName:
    column=[ColumnDefinition:Identifier];

Identifier returns string:
    ID | QUOTE_ID;

NumericExpression: value=NUMBER;

Type infers Type: 
    {infer BooleanType} 'BOOLEAN'
    //@see https://crate.io/docs/sql-99/en/latest//chapters/03.html
    | {infer IntegerType} ('INTEGER'|'INT')
    | {infer RealType} 'REAL'
    ; 

IntegerLiteral: value=NUMBER;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal QUOTE_ID: /"[^"]*"/;
terminal NUMBER returns number: /\d+((\.\d+)?([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
