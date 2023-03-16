grammar Sql

entry SqlFile:
    statements+=Statement*
    ;

Statement:
    (SchemaDefinition | FunctionDefinition | TableDefinition | RootLevelSelectStatement) ';';


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
    | IndexDefinition
    | KeyDefinition
    | ConstraintDefinition
    ;

ColumnDefinition:
    name=Identifier dataType=Type (negated?='NOT' null?='NULL')?;

PrimaryKeyDefinition:
    'PRIMARY' 'KEY' '(' primaryKeys+=[ColumnDefinition] (',' primaryKeys+=[ColumnDefinition])* ')'
    ;

IndexDefinition:
    'INDEX' '(' indexes+=[ColumnDefinition] (',' indexes+=[ColumnDefinition])* ')'
    ;

KeyDefinition:
    unique?='UNIQUE'? 'KEY' name=Identifier '(' keys+=[ColumnDefinition] (',' keys+=[ColumnDefinition])* ')'
    ;

ConstraintDefinition: //TODO fix absolute table name
    'CONSTRAINT' name=Identifier 'FOREIGN' 'KEY' '(' from=[ColumnDefinition] ')' 'REFERENCES' table=[TableDefinition:Identifier] '(' to=[ColumnDefinition] ')'
    ('ON' 'DELETE' cascadeDeletion?='CASCADE')?
    ;

FunctionDefinition:
    'CREATE' 'FUNCTION' (schemaName=[SchemaDefinition:Identifier] '.')? name=Identifier '('
        (params+=FormalParameterDefinition (',' params+=FormalParameterDefinition)*)?
    ')' 'AS' returnType=Type;

FormalParameterDefinition:
    name=Identifier dataType=Type
    ;
//END DEFINITION/////////////////////////////////////////////////////////

RootLevelSelectStatement:
    with=WithClause?
    select=SelectStatementRootExpression
    ;

SelectStatementRootExpression: SelectStatementUnionExpression;

SelectStatementUnionExpression infers SelectTableExpression:
    SelectStatementIntersectExpression ({infer BinaryTableExpression.left=current} operator=UnionSetOperator right=SelectStatementIntersectExpression)*
    ;

SelectStatementIntersectExpression infers SelectTableExpression:
    SelectStatementPrimaryExpression ({infer BinaryTableExpression.left=current} operator=IntersectSetOperator right=SelectStatementPrimaryExpression)*
    ;

SelectStatementPrimaryExpression infers SelectTableExpression:
    {infer SimpleSelectTableExpression} select=SimpleSelectStatement
    | {infer ParenthesesSelectTableExpression} '(' value=SelectStatementRootExpression ')'
    ;

UnionSetOperator infers SetOperator:
    operator=('UNION' | 'EXCEPT' | 'MINUS') ('ALL' | distinct?='DISTINCT')?
    ;

IntersectSetOperator infers SetOperator:
    operator='INTERSECT' ('ALL' | distinct?='DISTINCT')?
    ;

SimpleSelectStatement:
    'SELECT'
    select=SelectElements
    from=FromClause?
    where=WhereClause?
    groupBy=GroupByClause?
    having=HavingClause?
    orderBy=OrderByClause?
    ;
//;

WithClause: 'WITH' 'RECURSIVE'? ctes+=CommonTableExpression (',' ctes+=CommonTableExpression)*;

CteColumnName: name=Identifier;

CommonTableExpression:
    name=Identifier
    ('(' columnNames+=CteColumnName (',' columnNames+=CteColumnName)* ')')?
    'AS' statement=SelectStatementRootExpression
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
    ('ALL'|distinct?='DISTINCT')? elements+=SelectElement (',' elements+=SelectElement)*
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
    (leftJoin?='LEFT'|rightJoin?='RIGHT')? 'JOIN' nextItem=SourceItem ('ON' joinOn=Expression | 'USING' '(' usingOn=Expression ')')?
    ;

SourceItem infers SourceItem
    : {infer TableSourceItem} (schemaName=[SchemaDefinition:Identifier] '.')? tableName=[TableLike:Identifier] ('AS'? name=Identifier)?
    | {infer SubQuerySourceItem} '(' subQuery=SelectStatementRootExpression ')' ('AS'? name=Identifier)?
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
    | {infer SubQueryExpression} '(' subQuery=SelectStatementRootExpression ')'
    | {infer FunctionCall} (schemaName=[SchemaDefinition:Identifier] '.')? functionName=[FunctionDefinition:Identifier] '(' params=SelectElements? ')' 
      overClause=OverClause?
    | {infer ColumnNameExpression} columnName=[ColumnNameSource:Identifier]
    | {infer NullLiteral} 'NULL'
    | {infer HexStringLiteral} HexStringLiteral
    ;

OverClause:
    'OVER' ('(' spec=WindowSpec ')' | windowName=[WindowSpec:Identifier])
    ;


WindowSpec
    : name=Identifier? PartitionClause? OrderByClause? FrameClause?
    ;

FrameClause
    : units=FrameUnits extent=FrameExtent
    ;

FrameUnits returns string
    : 'ROWS'
    | 'RANGE'
    ;

FrameExtent
    : FrameRange
    | FrameBetween
    ;

FrameBetween
    : 'BETWEEN' FrameRange 'AND' FrameRange
    ;

FrameRange
    : 'CURRENT' 'ROW'
    | 'UNBOUNDED' ('PRECEDING' | 'FOLLOWING')
    | Expression ('PRECEDING' | 'FOLLOWING')
    ;

PartitionClause
    : 'PARTITION' 'BY' exprs+=Expression (',' exprs+=Expression)*
    ;

CastExpression:
    'CAST' '(' expr=Expression 'AS' type=Type ')'
    ;

type ColumnNameSource = ColumnDefinition|ExpressionQuery;

Identifier returns string:
    ID
    | TICK_STRING
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
terminal TICK_STRING returns string: /\`(\\.|\\\\|[^`\\])*\`/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER returns number: /\d+((\.\d+)?([eE][\-+]?\d+)?)?/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /(\/\/|\-\-)[^\n\r]*/;
