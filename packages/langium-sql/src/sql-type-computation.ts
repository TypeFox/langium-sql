/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { assertUnreachable, AstNode } from "langium";
import _ from "lodash";
import {
    Expression,
    isCastExpression,
    isExpression,
    Type,
    isTableRelatedColumnExpression,
    isBinaryExpression,
    isUnaryExpression,
    isNumberLiteral,
    isStringLiteral,
    isBooleanLiteral,
    isFunctionCall,
    isSubQueryExpression,
    isExpressionQuery,
    isTableSourceItem,
    isSubQuerySourceItem,
    isType,
    isColumnDefinition,
    isColumnNameExpression,
    isCteColumnName,
    isFunctionDefinition,
    isNegatableExpression,
    isBetweenExpression,
    isNullLiteral,
    isHexStringLiteral,
    isParenthesisOrListExpression,
    NegatableExpression,
    SelectTableExpression,
    isIdentifierAsStringLiteral,
} from "./generated/ast";
import { canConvert } from "./sql-type-conversion";
import { areTypesEqual, RowTypeDescriptor, TypeDescriptor, Types } from "./sql-type-descriptors";
import { BinaryOperator, BinaryOperators, UnaryOperator, UnaryOperators } from "./sql-type-operators";
import {
    getColumnsForSelectTableExpression, getFromGlobalReference,
} from "./sql-type-utilities";
import * as DataTypes from "./sql-data-types";
import { SqlServices } from "./sql-module";

export interface TypeComputer {
    computeType(node: AstNode): TypeDescriptor | undefined;
    computeTypeOfSelectStatement(selectStatement: SelectTableExpression): RowTypeDescriptor;
    computeTypeOfNumericLiteral(text: string): TypeDescriptor | undefined;
}

export class SqlTypeComputer implements TypeComputer {
    protected dataTypes: DataTypes.DialectTypes;
    constructor(services: SqlServices) {
        this.dataTypes = services.dialect.dataTypes;
     }
    computeType(node: AstNode): TypeDescriptor | undefined {
        if (isExpression(node)) {
            return this.computeTypeOfExpression(node);
        } else if(isType(node)) {
            return this.computeTypeOfDataType(node);
        }
        return undefined;
    }
    protected computeTypeOfExpression(node: Expression): TypeDescriptor | undefined {
        if (isCastExpression(node)) {
            const source = this.computeType(node.expr);
            const target = this.computeTypeOfDataType(node.type);
            return source && target && canConvert(source, target, 'explicit') ? target : undefined;
        }
        if (isNumberLiteral(node)) {
            return this.computeTypeOfNumericLiteral(node.$cstNode!.text);
        }
        if(isNullLiteral(node)) {
            return Types.Null;
        }
        if(isHexStringLiteral(node)) {
            return Types.Integer;
        }
        if (isTableRelatedColumnExpression(node)) { //variable.columnName
            const varRef = node.variableName.ref;
            if(!varRef) {
                return undefined;
            } else if(isTableSourceItem(varRef)) { //tableVariable.columnName
                const ref = node.columnName.ref;
                if(!isColumnDefinition(ref)) {
                    return undefined;
                }
                return this.computeType(ref.dataType);
            } else if(isSubQuerySourceItem(varRef)) {//subqueryVariable.selectItemName
                const ref = node.columnName.ref;
                if(!isExpressionQuery(ref)) {
                    return undefined;
                }
                return this.computeType(ref.expr);
            } else {
                assertUnreachable(varRef);
                return undefined;
            }
        }
        if (isParenthesisOrListExpression(node)) {
            const firstType = this.computeType(node.items[0]);
            //ONLY the IN operator is allowed to look up a list!
            if(firstType && node.$container.$type === NegatableExpression && node.$container.operator === 'IN') {
                return Types.ArrayOf(firstType);
            }
            return firstType;
        }
        if (isUnaryExpression(node)) {
            const operandType = this.computeType(node.value);
            return operandType != null
                ? this.computeTypeOfUnaryOperation(node.operator, operandType)
                : undefined;
        }
        if (isStringLiteral(node)) {
            return Types.Char();
        }
        if (isBooleanLiteral(node)) {
            return Types.Boolean;
        }
        if (isColumnNameExpression(node)) {
            const ref = node.columnName.ref;
            if(!ref) {
                return undefined;
            } else if(isExpressionQuery(ref)) {
                return this.computeType(ref.expr);
            } else if(isColumnDefinition(ref)) {
                return this.computeType(ref.dataType);
            } else if(isCteColumnName(ref)) {
                throw new Error('TODO')
            } else {
                assertUnreachable(ref);
            }
        }
        if (isFunctionCall(node)) {
            const functionLike = getFromGlobalReference(node.function, isFunctionDefinition);
            if(functionLike) {
                return this.computeTypeOfDataType(functionLike.returnType);
            } else {
                return undefined;
            }
        }
        if (isBinaryExpression(node) || isNegatableExpression(node)) {
            const left = this.computeType(node.left);
            const right = this.computeType(node.right);
            if (left && right) {
                return this.computeTypeOfBinaryOperation(node.operator, left, right);
            }
            return undefined;
        }
        if(isBetweenExpression(node)) {
            return Types.Boolean;
        }
        if(isSubQueryExpression(node)) {
            return this.computeTypeOfSelectStatement(node.subQuery);
        }
        if(isIdentifierAsStringLiteral(node)) {
            return Types.Char();
        }
        assertUnreachable(node);
    }
    
    computeTypeOfSelectStatement(selectStatement: SelectTableExpression): RowTypeDescriptor {
        return {
            discriminator: "row",
            columnTypes: getColumnsForSelectTableExpression(selectStatement).map(c => ({
                name: c.name,
                type: this.computeType(c.typedNode)!
            }))
        };
    }

    private computeTypeOfDataType(dataType: Type): TypeDescriptor | undefined {
        if (this.dataTypes.isBooleanDataType(dataType)) {
            return Types.Boolean;
        }
        if (this.dataTypes.isIntegerDataType(dataType)) {
            return Types.Integer;
        }
        if (this.dataTypes.isRealDataType(dataType)) {
            return Types.Real;
        }
        if (this.dataTypes.isStringDataType(dataType)) {
            return Types.Char();
        }
        if (this.dataTypes.isEnumDataType(dataType)) {
            return Types.Enum(dataType.arguments.map(e => e.value));
        }
        if (this.dataTypes.isDateTimeDataType(dataType)) {
            return Types.DateTime;
        }
        if (this.dataTypes.isBlobDataType(dataType)) {
            return Types.Blob;
        }
        return Types.Unknown;
    }

    computeTypeOfNumericLiteral(
        text: string
    ): TypeDescriptor | undefined {
        const NumericLiteralPattern = /^(\d+)((\.(\d)+)?([eE]([\-+]?\d+))?)?$/;
        const match = NumericLiteralPattern.exec(text)!;
        const fractionalPart = match[4]?.length ?? 0;
        const exponent = parseInt(match[6] ?? "0", 10);
        return Math.max(0, fractionalPart - exponent) === 0 ? Types.Integer : Types.Real;
    }

    private computeTypeOfBinaryOperation(
        operator: BinaryOperator,
        left: TypeDescriptor,
        right: TypeDescriptor
    ): TypeDescriptor | undefined {
        const candidates = BinaryOperators[operator];
        for (const candidate of candidates) {
            if(areTypesEqual(candidate.left, left) && areTypesEqual(candidate.right, right)) {
                return candidate.returnType;
            } else {
                if(canConvert(left, candidate.left, 'implicit') && canConvert(right, candidate.right, 'implicit')) {
                    return candidate.returnType;
                }
            }
        }
        return undefined;
    }

    private computeTypeOfUnaryOperation(
        operator: UnaryOperator,
        operandType: TypeDescriptor
    ): TypeDescriptor | undefined {
        const candidates = UnaryOperators[operator];
        for (const candidate of candidates) {
            if(areTypesEqual(candidate.operandType, operandType)) {
                return candidate.returnType;
            }
        }
        return undefined;
    }
}