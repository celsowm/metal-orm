/**
 * MetalORM core exports.
 * Provides schema definition, query building, and ORM capabilities.
 */
export * from './schema/table.js';
export * from './schema/column-types.js';
export * from './schema/relation.js';
export * from './schema/types.js';
export * from './query-builder/select.js';
export * from './query-builder/select-helpers.js';
export * from './query-builder/insert.js';
export * from './query-builder/update.js';
export * from './query-builder/delete.js';
export * from './core/ast/expression.js';
export * from './core/ast/window-functions.js';
export * from './core/hydration/types.js';
export * from './core/dialect/mysql/index.js';
export * from './core/dialect/mssql/index.js';
export * from './core/dialect/sqlite/index.js';
export * from './core/dialect/postgres/index.js';
export * from './core/ddl/schema-generator.js';
export * from './core/ddl/schema-types.js';
export * from './core/ddl/schema-diff.js';
export * from './core/ddl/schema-introspect.js';
export * from './core/ddl/introspect/registry.js';
export * from './core/functions/text.js';
export * from './core/functions/numeric.js';
export * from './core/functions/datetime.js';
export * from './core/functions/control-flow.js';
export * from './orm/als.js';
export * from './orm/hydration.js';
export * from './codegen/typescript.js';
export * from './orm/orm-session.js';
export * from './orm/orm.js';
export * from './orm/entity.js';
export * from './orm/lazy-batch.js';
export * from './orm/relations/has-many.js';
export * from './orm/relations/belongs-to.js';
export * from './orm/relations/many-to-many.js';
export * from './orm/execute.js';
export * from './orm/entity-context.js';
export * from './orm/execution-context.js';
export * from './orm/hydration-context.js';
export * from './orm/domain-event-bus.js';
export * from './orm/runtime-types.js';
export * from './orm/query-logger.js';
export * from './orm/jsonify.js';
export * from './orm/save-graph-types.js';
export * from './decorators/index.js';

// NEW: execution abstraction + helpers
export * from './core/execution/db-executor.js';
export * from './core/execution/pooling/pool-types.js';
export * from './core/execution/pooling/pool.js';
export * from './core/execution/executors/postgres-executor.js';
export * from './core/execution/executors/mysql-executor.js';
export * from './core/execution/executors/sqlite-executor.js';
export * from './core/execution/executors/mssql-executor.js';

// NEW: first-class pooling integration
export * from './orm/pooled-executor-factory.js';

