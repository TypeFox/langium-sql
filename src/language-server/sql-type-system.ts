/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode } from "langium";
import _ from "lodash";
import { Expression, isBooleanType, isFloatType, isCastExpression, isColumnName, isDecimalType, isDoublePrecisionType, isExpression, isIntegerType, isNumericType, isRealType, isSmallIntType, Type, isNumericExpression, isTableRelatedColumnExpression, isBinaryExpression } from "./generated/ast";
import { TypeDescriptor } from "./sql-type-descriptors";
import { assertUnreachable, computeTypeOfBinaryOperation, computeTypeOfNumericLiteral } from "./sql-type-utilities";

export type ComputeTypeFunction = (node: AstNode) => TypeDescriptor|undefined;
export const createCachedComputeType = function(): ComputeTypeFunction {
  return _.memoize(computeType);  

  function computeType(node: AstNode): TypeDescriptor | undefined {
    if(isExpression(node)) {
      return computeTypeOfExpression(node);
    }
    return undefined;
  }

  function computeTypeOfExpression(node: Expression): TypeDescriptor | undefined {
    if(isNumericExpression(node)) {
      return computeTypeOfNumericLiteral(node.$cstNode!.text);
    }
    if(isTableRelatedColumnExpression(node)) {
      const dataType = node.columnName.column.ref?.dataType;
      return dataType ? getTypeOfDataType(dataType) : undefined;
    }
    if(isColumnName(node)) {
      const dataType = node.column.ref?.dataType;
      return dataType ? getTypeOfDataType(dataType) : undefined;
    }
    if(isCastExpression(node)) {
      return getTypeOfDataType(node.type);
    }
    if(isBinaryExpression(node)) {
      const left = computeType(node.left);
      const right = computeType(node.right);
      if(left && right) {
        return computeTypeOfBinaryOperation(node.operator, left, right);
      }
      return undefined;
    }
    assertUnreachable(node); 
  }
  
  function getTypeOfDataType(dataType: Type): TypeDescriptor | undefined {
    if(isBooleanType(dataType)) {
      return {discriminator: 'boolean'};
    }
    if(isNumericType(dataType)) {
      return {
        discriminator: 'numeric',
        //TODO find correct default values
        precision: dataType.precision?.value ?? 9,
        scale: dataType.scale?.value ?? 0
      };
    }
    if(isDecimalType(dataType)) {
      return {
        discriminator: 'decimal',
        //TODO find correct default values
        precision: dataType.precision?.value ?? 9,
        scale: dataType.scale?.value ?? 0
      };
    }
    if(isDoublePrecisionType(dataType)) {
      return {
        discriminator: 'double'
      };
    }
    if(isSmallIntType(dataType)) {
      return {
        discriminator: 'smallint'
      };
    }
    if(isIntegerType(dataType)) {
      return {
        discriminator: 'integer'
      };
    }
    if(isRealType(dataType)) {
      return {
        discriminator: 'real'
      };
    }
    if(isFloatType(dataType)) {
      return {
        discriminator: 'float',
        //TODO find correct default value
        precision: dataType.precision?.value ?? 9,
      };
    }
    assertUnreachable(dataType);
  }  
}