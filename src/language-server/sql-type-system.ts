/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { AstNode } from "langium";
import _ from "lodash";
import { Expression, isBooleanType, isFloatType, isCastExpression, isColumnName, isDecimalType, isDoublePrecisionType, isExpression, isIntegerType, isNumeric, isNumericType, isRealType, isSmallIntType, isTableRelatedColumn, Type } from "./generated/ast";
import { TypeDescriptor } from "./sql-type-descriptors";
import { getTypeOfNumericLiteral } from "./sql-type-utilities";


export const createCachedComputeType = function() {
  return _.memoize(function computeType(node: AstNode): TypeDescriptor | undefined {
    if(isExpression(node)) {
      return getExpressionType(node);
    }
    return undefined;
  });  
}

function getExpressionType(node: Expression): TypeDescriptor | undefined {
  if(isNumeric(node)) {
    return getTypeOfNumericLiteral(node.$cstNode!.text);
  }
  if(isTableRelatedColumn(node)) {
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
  assertUnreachable(node); 
}

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
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

