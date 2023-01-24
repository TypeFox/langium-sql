import { AstNode } from "langium";
import _ from "lodash";
import { Expression, isCastExpression, isColumnName, isExpression, isNumeric, isTableRelatedColumn } from "./generated/ast";
import { TypeDescriptor } from "./sql-type-descriptors";
import { getTypeOfNumericLiteral } from "./sql-type-utilities";

export const computeType = _.memoize(function(node: AstNode): TypeDescriptor | undefined {
  if(isExpression(node)) {
    return getExpressionType(node);
  }
  return undefined;
});

function getExpressionType(node: Expression): TypeDescriptor | undefined {
  if(isNumeric(node)) {
    return getTypeOfNumericLiteral(node.$cstNode!.text);
  } else if(isTableRelatedColumn(node)) {
    return //TODO
  } else if(isColumnName(node)) {
    return // TODO
  } else if(isCastExpression(node)) {
    return //TODO
  } else {
    assertUnreachable(node);
  } 
}

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}
