/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import {
  AstNodeDescription,
  AstNodeDescriptionProvider,
  DefaultScopeProvider,
  getContainerOfType,
  hasContainerOfType,
  LangiumServices,
  ReferenceInfo,
  Scope,
  stream,
  StreamScope,
} from "langium";
import {
  isColumnName,
  isSelectStatement,
  isTableName,
  isTableRelatedColumnExpression,
  isTableVariableName,
  SelectStatement,
} from "./generated/ast";

export class SqlScopeProvider extends DefaultScopeProvider {
  private readonly astNodeDescriptionProvider: AstNodeDescriptionProvider;

  constructor(services: LangiumServices) {
    super(services);
    this.astNodeDescriptionProvider =
      services.workspace.AstNodeDescriptionProvider;
  }

  override getScope(context: ReferenceInfo): Scope {
    if (isColumnName(context.container) && context.property === "column") {
      if (hasContainerOfType(context.container, isTableRelatedColumnExpression)) {
        const tableRelated = getContainerOfType(
          context.container,
          isTableRelatedColumnExpression
        )!;
        const columns =
          tableRelated.variableName.variable.ref!.tableName.table.ref!.columns;
        return new StreamScope(
          stream(
            columns.map((c) =>
              this.astNodeDescriptionProvider.createDescription(c, c.name)
            )
          )
        );
      } else {
        const selectStatement = getContainerOfType(
          context.container,
          isSelectStatement
        );
        return this.getColumnsForSelectStatement(context, selectStatement!);
      }
    }
    if (isTableName(context.container) && context.property === "table") {
      return this.getTablesFromGlobalScope(context);
    }
    if (
      isTableVariableName(context.container) &&
      context.property === "variable"
    ) {
      const selectStatement = getContainerOfType(
        context.container,
        isSelectStatement
      );
      return this.getTableVariablesForSelectStatement(
        context,
        selectStatement!
      );
    }
    return super.getScope(context);
  }

  private getTableVariablesForSelectStatement(
    context: ReferenceInfo,
    selectStatement: SelectStatement
  ): Scope {
    if (selectStatement.from) {
      const astDescriptions: AstNodeDescription[] = [];
      for (const source of selectStatement.from.sources.list) {
        if (source.item.name) {
          astDescriptions.push(
            this.astNodeDescriptionProvider.createDescription(
              source.item,
              source.item.name
            )
          );
        }
      }
      return new StreamScope(stream(astDescriptions));
    }
    return super.getScope(context);
  }

  private getColumnsForSelectStatement(
    context: ReferenceInfo,
    selectStatement: SelectStatement
  ): Scope {
    if (selectStatement.from) {
      const astDescriptions: AstNodeDescription[] = [];
      for (const source of selectStatement.from.sources.list) {
        if (!source.item.name && source.item.tableName.table.ref) {
          for (const column of source.item.tableName.table.ref.columns) {
            astDescriptions.push(
              this.astNodeDescriptionProvider.createDescription(
                column,
                column.name
              )
            );
          }
        }
      }
      return new StreamScope(stream(astDescriptions));
    }
    return super.getScope(context);
  }

  private getTablesFromGlobalScope(_context: ReferenceInfo): Scope {
    return new StreamScope(this.indexManager.allElements("TableDefinition"));
  }
}
