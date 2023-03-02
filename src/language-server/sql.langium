grammar Sql

entry SqlFile:
    statements+=Statement*
    ;

Statement:
    (SchemaDefinition | FunctionDefinition | TableDefinition | SelectStatement) ';';


//DEFINITION/////////////////////////////////////////////////////////
SchemaDefinition:
    'CREATE' 'SCHEMA' name=Identifier; 

TableDefinition:
    'CREATE' 'TABLE' (schemaName=[SchemaDefinition:Identifier] '.')? name=Identifier '('(
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

ConstraintDefinition: //TODO fix absolute table name
    'CONSTRAINT' name=Identifier 'FOREIGN' 'KEY' '(' from=[ColumnDefinition] ')' 'REFERENCES' table=[TableDefinition:Identifier] '(' to=[ColumnDefinition] ')'
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
    | {infer AllTable}variableName=[TableVariableSource:Identifier] '.' '*'
    | {infer ExpressionQuery} expr=Expression ('AS'? name=Identifier)?
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
    : {infer TableSourceItem} (schemaName=[SchemaDefinition:Identifier] '.')? tableName=[TableLike:Identifier] ('AS'? name=Identifier)?
    | {infer SubQuerySourceItem} '(' subQuery=SelectStatement ')' ('AS'? name=Identifier)?
    ;

type TableVariableSource = TableSourceItem|SubQuerySourceItem;

type TableLike = TableDefinition|CommonTableExpression;

Expression: ConcatExpression;

ConcatExpression infers Expression:
    OrExpression ({infer BinaryExpression.left=current} operator='||' right=OrExpression)*
    ;

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
    NegatableExpression ({infer BinaryExpression.left=current} operator=('<='|'>='|'<'|'>') right=NegatableExpression)*
    ;

NegatableExpression infers Expression:
    AdditiveExpression ({infer NegatableExpression.left=current} (operator=('IS') negated?='NOT'?|negated?='NOT'? operator=('IN'|'LIKE')) right=AdditiveExpression)*
    | AdditiveExpression ({infer BetweenExpression.subExpr=current} negated?='NOT'? 'BETWEEN' left=AdditiveExpression 'AND' right=AdditiveExpression) 
    ;

AdditiveExpression infers Expression:
    MultiplicativeExpression ({infer BinaryExpression.left=current} operator=('+'|'-') right=MultiplicativeExpression)*
    ;

MultiplicativeExpression infers Expression:
    PrimaryExpression ({infer BinaryExpression.left=current} operator=('*'|'/'|'%') right=PrimaryExpression)*
    ;

PrimaryExpression infers Expression:
    {infer StringLiteral} StringLiteral
    | {infer TableRelatedColumnExpression} variableName=[SourceItem:Identifier] '.' columnName=[ColumnNameSource:Identifier]
    | {infer NumberLiteral} NumberLiteral
    | {infer BooleanLiteral} BooleanLiteral
    | {infer CastExpression} CastExpression
    | {infer UnaryExpression} operator=('NOT'|'-'|'+') value=PrimaryExpression
    | {infer ParenthesisOrListExpression} '(' items+=Expression (',' items+=Expression)* ')'
    | {infer SubQueryExpression} '(' subQuery=SelectStatement ')'
    | {infer FunctionCall} functionName=[FunctionDefinition:Identifier] '(' params=SelectElements? ')'
    | {infer ColumnNameExpression} columnName=[ColumnNameSource:Identifier]
    | {infer NullLiteral} 'NULL'
    | {infer HexStringLiteral} HexStringLiteral
    ;

CastExpression:
    'CAST' '(' expr=Expression 'AS' type=Type ')'
    ;

type ColumnNameSource = ColumnDefinition|ExpressionQuery;

Identifier returns string:
    ID
    | STRING
    ;

NumberLiteral: value=NUMBER;
StringLiteral: value=STRING;
BooleanLiteral: value=('TRUE'|'FALSE');
HexStringLiteral: value=HEX_STRING;

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
terminal HEX_STRING returns string: /x\'[A-Fa-f0-9]+\'/;
terminal STRING returns string: /\'(\\.|\\\\|[^'\\])*\'/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER returns number: /\d+((\.\d+)?([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /(\/\/|\-\-)[^\n\r]*/;
