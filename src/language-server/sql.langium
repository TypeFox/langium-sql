grammar Sql

entry SqlFile:
    statements+=Statement*
    ;

Statement:
    (FunctionDefinition | TableDefinition | SelectStatement) ';';


//DEFINITION/////////////////////////////////////////////////////////
TableDefinition:
    'CREATE' 'TABLE' name=Identifier '('(
        columns+=TableContentDefinition (',' columns+=TableContentDefinition)* trailingComma?=','?
    )?')';

TableContentDefinition:
    ColumnDefinition
    | PrimaryKeyDefinition
    | KeyDefinition
    | ConstraintDefinition
    ;

ColumnDefinition:
    name=Identifier dataType=Type (negated?='NOT' null?='NULL')?;

PrimaryKeyDefinition:
    'PRIMARY' 'KEY' '(' primaryKeys+=[ColumnDefinition] (',' primaryKeys+=[ColumnDefinition])* ')'
    ;


KeyDefinition:
    unique?='UNIQUE'? 'KEY' name=Identifier '(' keys+=[ColumnDefinition] (',' keys+=[ColumnDefinition])* ')'
    ;

ConstraintDefinition:
    'CONSTRAINT' name=Identifier 'FOREIGN' 'KEY' '(' from=[ColumnDefinition] ')' 'REFERENCES' table=[TableDefinition] '(' to=[ColumnDefinition] ')'
    ('ON' 'DELETE' cascadeDeletion?='CASCADE')?
    ;

FunctionDefinition:
    'CREATE' 'FUNCTION' name=Identifier '('
        (params+=FormalParameterDefinition (',' params+=FormalParameterDefinition)*)?
    ')' 'AS' returnType=Type;

FormalParameterDefinition:
    name=Identifier dataType=Type
    ;
//END DEFINITION/////////////////////////////////////////////////////////

SelectStatement:
    with=WithClause?
    'SELECT' ('ALL'|distinct?='DISTINCT')?
    select=SelectElements
    from=FromClause?
    where=WhereClause?
    groupBy=GroupByClause?
    having=HavingClause?
    orderBy=OrderByClause?;

WithClause: 'WITH' 'RECURSIVE'? ctes+=CommonTableExpression (',' ctes+=CommonTableExpression)*;

CteColumnName: name=Identifier;

CommonTableExpression:
    name=Identifier
    ('(' columnNames+=CteColumnName (',' columnNames+=CteColumnName)* ')')?
    'AS' statement=SelectStatement
    ;

WhereClause:
    'WHERE' rowCondition=Expression;

HavingClause:
    'HAVING' groupCondition=Expression
    ;

GroupByClause:
    'GROUP' 'BY' specs+=Expression (',' specs+=Expression)*
    ;

OrderByClause:
    'ORDER' 'BY' specs+=OrderBySpec (',' specs+=OrderBySpec)*
    ;

OrderBySpec:
    scalar=Expression ('ASC'|'DESC')?
    ;

SelectElements:
    elements+=SelectElement (',' elements+=SelectElement)*
    ;
    
SelectElement infers SelectElement:
    {infer AllStar}'*'
    | {infer AllTable}variableName=TableVariableName '.' '*'
    | {infer ExpressionQuery} expr=Expression ('AS' name=Identifier)?
    ;
    
FromClause: 'FROM' sources=TableSources;

TableSources: list+=TableSource (',' list+=TableSource)*;

TableSource:
    item=SourceItem joins+=JoinPart*
    ;

JoinPart:
    'JOIN' nextItem=SourceItem ('ON' joinOn=Expression | 'USING' '(' usingOn=Expression ')')?
    ;

SourceItem infers SourceItem
    : {infer TableSourceItem} tableName=TableName ('AS'? name=Identifier)?
    | {infer SubQuerySourceItem} '(' subQuery=SelectStatement ')' ('AS'? name=Identifier)?
    ;

type TableVariableSource = TableSourceItem|SubQuerySourceItem;

TableVariableName:
    variable=[TableVariableSource:Identifier]
    ;

type TableLike = TableDefinition|CommonTableExpression;

TableName: table=[TableLike:Identifier];

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
    {infer StringLiteral} StringLiteral
    | {infer TableRelatedColumnExpression} variableName=TableVariableName '.' columnName=ColumnName
    | {infer NumberLiteral} NumberLiteral
    | {infer BooleanLiteral} BooleanLiteral
    | {infer CastExpression} CastExpression
    | {infer UnaryExpression} operator=('NOT'|'-'|'+') value=PrimaryExpression
    | {infer ParenthesisExpression} '(' expression=Expression ')'
    | {infer SubQueryExpression} '(' subQuery=SelectStatement ')'
    | {infer FunctionCall} functionName=FunctionName '(' params=SelectElements? ')'
    | {infer ColumnNameExpression} columnName=ColumnName
    ;

CastExpression:
    'CAST' '(' expr=Expression 'AS' type=Type ')'
    ;

FunctionName:
    function=[FunctionDefinition:Identifier]
    ;

type ColumnNameSource = ColumnDefinition|ExpressionQuery;

ColumnName: column=[ColumnNameSource:Identifier];

Identifier returns string:
    ID
    ;

NumberLiteral: value=NUMBER;
StringLiteral: value=STRING;
BooleanLiteral: value=('TRUE'|'FALSE');

Type infers Type: 
    {infer BooleanType} 'BOOLEAN'
    | {infer IntegerType} ('INTEGER'|'INT')
    | {infer RealType} 'REAL'
    | {infer CharType} 'CHAR' ('(' length=IntegerLiteral ')')?
    | {infer EnumType} 'ENUM' '(' members+=STRING (',' members+=STRING)* ')'
    | {infer DateTimeType} 'DATETIME'
    ; 

IntegerLiteral: value=NUMBER;

hidden terminal WS: /\s+/;
terminal STRING returns string: /\'(\\.|\\\\|[^'\\])*\'/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER returns number: /\d+((\.\d+)?([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /(\/\/|\-\-)[^\n\r]*/;
