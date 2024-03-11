/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Module, DeepPartial, inject } from "langium";
import { LangiumServices, LangiumSharedServices, DefaultSharedModuleContext, createDefaultSharedModule, createDefaultModule } from "langium/lsp";
import { SqlDialectTypes } from "./dialects/sql/data-types.js";
import {
    SqlGeneratedModule,
    SqlGeneratedSharedModule,
} from "./generated/module.js";
import { SqlCompletionProvider } from "./sql-completion-provider.js";
import { SqlContainerManager } from "./sql-container-manager.js";
import { DialectTypes } from "./sql-data-types.js";
import { SqlNameProvider } from "./sql-name-provider.js";
import { SqlScopeComputation } from "./sql-scope-computation.js";
import { SqlScopeProvider } from "./sql-scope-provider.js";
import { SqlSemanticTokenProvider } from "./sql-semantic-token-provider.js";
import { SqlTypeComputer, TypeComputer } from "./sql-type-computation.js";
import { SqlValidationRegistry, SqlValidator } from "./sql-validator.js";
import { SqlValueConverter } from "./sql-value-converter.js";
import { SqlWorkspaceManager } from "./sql-workspace-manager.js";

/**
 * Declaration of custom services - add your own service classes here.
 */
export type SqlAddedServices = {
    dialect: {
        dataTypes: DialectTypes,
        typeComputer: TypeComputer
    }
    validation: {
        SqlValidator: SqlValidator
    }
    shared: SqlSharedServices
};

export type SqlAddedSharedServices = {
    workspace: {
        WorkspaceManager: SqlWorkspaceManager
        ContainerManager: SqlContainerManager
    };
};

export const SqlSharedModule: Module<
    SqlSharedServices,
    DeepPartial<SqlSharedServices>
> = {
    workspace: {
        WorkspaceManager: (services) => new SqlWorkspaceManager(services),
        ContainerManager: (services) => new SqlContainerManager(services)
    }
};

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type SqlServices = LangiumServices & SqlAddedServices;

export type SqlSharedServices = LangiumSharedServices & SqlAddedSharedServices;

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const SqlModule: Module<
    SqlServices,
    DeepPartial<SqlServices>
> = {
    dialect: {
        dataTypes: () => new DialectTypes(SqlDialectTypes),
        typeComputer: services => new SqlTypeComputer(services)
    },
    parser: {
        ValueConverter: () => new SqlValueConverter(),
    },
    references: {
        NameProvider: () => new SqlNameProvider(),
        ScopeComputation: (services) => new SqlScopeComputation(services),
        ScopeProvider: (services) => new SqlScopeProvider(services),
    },
    lsp: {
        SemanticTokenProvider: (services) => new SqlSemanticTokenProvider(services),
        CompletionProvider: (services) => new SqlCompletionProvider(services),
    },
    validation: {
        ValidationRegistry: (services) => new SqlValidationRegistry(services),
        SqlValidator: (services) => new SqlValidator(services),
    },
};

export interface SqlSharedModuleContext extends DefaultSharedModuleContext {
    module?: Module<SqlServices, DeepPartial<SqlServices>>
    sharedModule?: Module<SqlSharedServices, DeepPartial<SqlSharedServices>>
}

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 *
 * @param context Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific services
 */
export function createSqlServices(context: SqlSharedModuleContext): {
    shared: SqlSharedServices;
    Sql: SqlServices;
} {
    const shared = inject(
        createDefaultSharedModule(context),
        SqlGeneratedSharedModule,
        SqlSharedModule,
        context.sharedModule
    );
    const Sql = inject(
        createDefaultModule({ shared }),
        SqlGeneratedModule,
        SqlModule,
        context.module
    );
    shared.ServiceRegistry.register(Sql);
    return { shared, Sql };
}
