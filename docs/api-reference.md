# API Reference

MetalORM is layered. Use only what you need:

- **Schema & relations**: declarative tables/columns/hooks.
- **Expressions & AST**: typed builders that drive SQL generation.
- **Query builders**: Select/Insert/Update/Delete over the AST.
- **Hydration**: turn flat rows into nested objects.
- **ORM runtime**: entities, lazy/batched relations, Unit of Work.
- **Dialects & codegen**: multi-dialect compilation and AST printers.

## Schema & Relations

- `defineTable(name, columns, relations?, hooks?) => TableDef`
  - Normalizes column/table names at runtime and wires relations.
- `col.int()`, `col.varchar(length)`, `col.json()`, `col.boolean()`
- Temporal columns default to `string` typing; pass a generic or set `tsType` to match your driver runtime, e.g. `col.date<Date>()`, `col.datetime<Date>()`, `col.timestamp<Date>()`.
- `col.primaryKey(def)` marks an existing column as PK.
- `hasMany(target, foreignKey, localKey?, cascade?)`
- `hasOne(target, foreignKey, localKey?, cascade?)`
- `belongsTo(target, foreignKey, localKey?, cascade?)`
- `belongsToMany(target, pivotTable, { pivotForeignKeyToRoot, pivotForeignKeyToTarget, localKey?, targetKey?, pivotPrimaryKey?, defaultPivotColumns?, cascade? })`
- Table hooks (optional, per table):
  - `beforeInsert/afterInsert`, `beforeUpdate/afterUpdate`, `beforeDelete/afterDelete`

## Decorators (optional)

- `@Entity({ tableName?, hooks? })` decorates a class and sets the table name (defaulting to the class name if omitted).
- `@Column({ type, args?, notNull?, primary? })` shares the same shape as a `ColumnDef` and registers the decorated field as a column.
- `@PrimaryKey(...)` is a convenience wrapper around `@Column` that marks the column as the primary key.
- `@HasMany({ target: Entity | TableDef | () => Entity/ TableDef, foreignKey, localKey?, cascade? })`.
- `@HasOne({ target: Entity | TableDef | () => Entity/ TableDef, foreignKey, localKey?, cascade? })`.
- `@BelongsTo({ target, foreignKey, localKey?, cascade? })`.
- `@BelongsToMany({ target, pivotTable, pivotForeignKeyToRoot, pivotForeignKeyToTarget, localKey?, targetKey?, pivotPrimaryKey?, defaultPivotColumns?, cascade? })`.
- Decorators rely on TS 5+ standard decorator support:
  - `experimentalDecorators: true`, `useDecoratorsLegacy: false`, `emitDecoratorMetadata: false`.
  - `moduleResolution: NodeNext`, `lib` includes `ESNext.decorators`.

Decorator metadata is stored in a registry so that the core ORM stays decorator-free. Import every entity module so decorators run, then invoke the decorator bootstrap helpers before creating the ORM:

```ts
import { createOrm, bootstrapEntities, defineTable, col } from 'metal-orm';

import './entities/User.js';
import './entities/Post.js';

const manualTables = [
  defineTable('legacy', {
    id: col.primaryKey(col.int())
  })
];

const tables = [...manualTables, ...bootstrapEntities()];

const orm = createOrm({ tables });
```

- `bootstrapEntities()` resolves all decorator metadata into `TableDef` instances and wires up relations (runs once at startup).
- `getTableDefFromEntity(MyEntity)` fetches the generated `TableDef` for a class that was already bootstrapped.
- `selectFromEntity(MyEntity)` starts a query builder directly from an entity class.
- Decorated and manually defined tables can coexist; pass both `TableDef[]` into `createOrm`.

## Expressions & AST Utilities

- Binary / logical / null checks: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `notLike`, `and`, `or`, `isNull`, `isNotNull`.
- Collections: `inList`, `notInList`, `inSubquery`, `notInSubquery`, `between`, `notBetween`.
- JSON & CASE: `jsonPath`, `caseWhen`.
- Existence: `exists`, `notExists`.
- Aggregates: `count`, `sum`, `avg`.
- Window functions: `rowNumber`, `rank`, `denseRank`, `ntile(n)`, `lag`, `lead`, `firstValue`, `lastValue`, `windowFunction(...)`.
- AST helpers: `buildColumnNode(table, column)`, `buildColumnNodes(table, names)`, `createTableNode(table)`.
- Visitors: `ExpressionVisitor`, `OperandVisitor`, `visitExpression()`, `visitOperand()` for custom printers or analysis.

## Query Builders

### Verb-First Entry Points (Recommended)

- `selectFrom(table | entity)` - starts a SELECT query
- `insertInto(table | entity)` - starts an INSERT query
- `update(table | entity)` - starts an UPDATE query
- `deleteFrom(table | entity)` - starts a DELETE query

These functions accept either a `TableDef` or an entity constructor and return the appropriate query builder.

### SelectQueryBuilder

- Construction: `selectFrom(table)` (recommended) or `new SelectQueryBuilder(table, state?, hydration?, deps?, lazyRelations?)`.
- Projection: `select({ ... })`, `selectRaw(...cols)`, `selectSubquery(alias, qb)`.
- CTEs: `with(name, qb, columns?)`, `withRecursive(name, qb, columns?)`.
- Filtering: `where(expr)`, `whereExists(qb)`, `whereNotExists(qb)`, `whereHas(relation, cb?)`, `whereHasNot(relation, cb?)`.
- Joins & relations: `innerJoin/leftJoin/rightJoin(table, condition)`, `match(relation, predicate?)`, `joinRelation(relation, kind?, extraCondition?)`.
- Includes: `include(relation, options?)` (eager hydration), `includeLazy(relation)` (lazy wrapper only).
- Grouping/ordering/paging: `groupBy`, `having`, `orderBy`, `distinct`, `limit`, `offset`.
- Runtime helpers (Level 2): `count(session)` and `executePaged(session, { page, pageSize })`.
- Compilation: `compile(dialect) => { sql, params }`, `toSql(dialect)`.
- Introspection: `getAST()`, `getHydrationPlan()`, `getTable()`, `getLazyRelations()`.
- ORM runtime: `execute(session)` runs the compiled query with the provided `OrmSession`, hydrates, and returns entity proxies.

### InsertQueryBuilder

- Construction: `insertInto(table)` (recommended) or `new InsertQueryBuilder(table, state?)`.
- Data: `values(row | row[])`.
- Returning: `returning(...columns)`.
- Compilation: `compile(compiler)`, `toSql(compiler)`, `getAST()`.

### UpdateQueryBuilder

- Construction: `update(table)` (recommended) or `new UpdateQueryBuilder(table, state?)`.
- Data: `set(values)`.
- Filtering: `where(expr)`.
- Returning: `returning(...columns)`.
- Compilation: `compile(compiler)`, `toSql(compiler)`, `getAST()`.

### DeleteQueryBuilder

- Construction: `deleteFrom(table)` (recommended) or `new DeleteQueryBuilder(table, state?)`.
- Filtering: `where(expr)`.
- Returning: `returning(...columns)`.
- Compilation: `compile(compiler)`, `toSql(compiler)`, `getAST()`.

## Dialects & Compilation

- Dialects: `MySqlDialect`, `SQLiteDialect`, `MSSQLDialect`, `PostgresDialect`.
- Each dialect compiles ASTs to `{ sql, params }` and supports `compileSelect`, `compileInsert`, `compileUpdate`, `compileDelete`.
- Use with builders via `qb.compile(dialect)` or through an `OrmSession`; the runtime reuses the same dialect for DML operations when you call `session.commit()`.

## Hydration

- `HydrationManager` (internal to the select builder) tracks included relations and emits a `HydrationPlan`.
- `hydrateRows(rows, plan?)` converts flat query results into nested objects (arrays for has-many / many-to-many, single objects for belongs-to) and attaches pivot data under `_pivot` when present.

- ## ORM Runtime
-
- `Orm`:
  - Query interceptors: `orm.interceptors.use((ctx, next) => ...)` runs around every SQL execution performed through an `OrmSession` execution context (SELECT/UPDATE/DELETE `.execute(session)`).
- `OrmSession`:
  - Options: `{ orm, executor, interceptors?, queryLogger?, domainEventHandlers? }` (`interceptors` here are flush lifecycle hooks: `beforeFlush` / `afterFlush`).
  - Tracking: `trackNew`, `trackManaged`, `markDirty`, `markRemoved`, `getEntity`, `setEntity`, `identityMap`, `unitOfWork`, `domainEvents`.
  - Flush: `commit()` runs interceptors, writes pending INSERT / UPDATE / DELETE / pivot changes, processes relation changes, and dispatches domain events.
  - Extensibility: `registerInterceptor()`, `registerDomainEventHandler()`, `addDomainEvent(entity, event)`, and `queryLogger` for SQL inspection.
- Entity proxies (from `createEntityFromRow` or via `SelectQueryBuilder.execute`):
  - Properties are the row fields; relations are lazy wrappers (`HasManyCollection`, `BelongsToReference`, `ManyToManyCollection`).
  - `$load(relationName)` loads a lazy relation on demand.
  - Mutations of mapped columns automatically mark the entity as dirty.
+ `createEntityFromRow(session, table, row, lazyRelations?)` accepts an optional `TResult` generic if you need to bind a specific entity type without casts.
- Relation wrappers:
  - `HasManyCollection`: `load()`, `getItems()`, `add(data)`, `attach(entity)`, `remove(entity)`, `clear()`.
  - `BelongsToReference`: `load()`, `get()`, `set(entity)`, `clear()`.
  - `ManyToManyCollection`: `load()`, `getItems()`, `add(data)`, `attach(entity, pivot?)`, `detach(entity)`, `clear()`.
- Low-level helpers:
- `executeHydrated(session, qb)` runs a select builder, hydrates rows, and returns entities (same as calling `qb.execute(session)`).
  - `AsyncLocalStorage<T>`: lightweight browser-friendly storage for request context.

## Code Generation

- `TypeScriptGenerator` converts a SELECT AST into a fluent builder chain (`SelectQueryBuilder`) to aid debugging or migrations.
- Build your own printers with `ExpressionVisitor` / `OperandVisitor` and `visitExpression()` / `visitOperand()`.

## DDL & Introspection

- `generateCreateTableSql(table, dialect) => { tableSql, indexSql[] }`
- `generateSchemaSql(tables, dialect) => string[]`
- `diffSchema(expectedTables, actualSchema, dialect, options?) => SchemaPlan`
- `synchronizeSchema(expectedTables, actualSchema, dialect, executor, options?) => SchemaPlan`
  - Options: `{ allowDestructive?: boolean, dryRun?: boolean }`.
- `introspectSchema(executor, dialectName, options?) => DatabaseSchema`
  - Options include `{ schema?, includeTables?, excludeTables? }` and are dialect-agnostic.
- `registerSchemaIntrospector(dialectName, introspector)` / `getSchemaIntrospector(dialectName)`
  - Override or extend built-in introspection strategies by plugging custom `introspect(executor, options) => Promise<DatabaseSchema>` implementations into the registry.
