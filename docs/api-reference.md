# API Reference

MetalORM is layered. Use only what you need:

- **Schema & relations**: declarative tables/columns/hooks.
- **Expressions & AST**: typed builders that drive SQL generation.
- **Query builders**: Select/Insert/Update/Delete over the AST.
- **Hydration**: turn flat rows into nested objects.
- **ORM runtime**: entities, lazy/batched relations, Unit of Work.
- **Dialects & codegen**: multi-dialect compilation and AST printers.
- **Execution & Pooling**: connection management and transaction execution.

## Schema & Relations

- `defineTable(name, columns, relations?, hooks?) => TableDef`
  - Normalizes column/table names at runtime and wires relations.
- **Column Types (`col.*`)**:
  - `int()`, `bigint()`, `varchar(length)`, `text()`, `decimal(p, s)`, `float(p?)`, `uuid()`, `json()`, `boolean()`.
  - `blob()`, `binary(l?)`, `varbinary(l?)`, `bytea()` (Postgres).
  - `date<T>()`, `datetime<T>()`, `timestamp<T>()`, `timestamptz<T>()`.
  - `enum(values[])`.
  - `custom(type, options?)` for dialect-specific types.
- **Column Constraints & Helpers**:
  - `col.primaryKey(def)` marks as PK.
  - `col.notNull(def)` marks as NOT NULL.
  - `col.unique(def, name?)` adds a unique constraint.
  - `col.default(def, value)` sets a static default.
  - `col.defaultRaw(def, sql)` sets a raw SQL default.
  - `col.autoIncrement(def, strategy?)` marks as auto-increment / identity.
  - `col.references(def, refOptions)` adds a foreign key.
  - `col.check(def, expression)` adds a CHECK constraint.
- **Relations**:
  - `hasMany(target, foreignKey, localKey?, cascade?)`
  - `hasOne(target, foreignKey, localKey?, cascade?)`
  - `belongsTo(target, foreignKey, localKey?, cascade?)`
  - `belongsToMany(target, pivotTable, options)`
- **Table hooks** (optional, per table):
  - `beforeInsert/afterInsert`, `beforeUpdate/afterUpdate`, `beforeDelete/afterDelete`
- **Column introspection helpers** (new):
  - `getColumnType(target, column)` reads the normalized column type (`'int'`, `'varchar'`, `'date'`, `'datetime'`, etc.) from a `TableDef` or decorator-backed entity.
  - `getDateKind(target, column)` answers whether a temporal column is treated as a `date` (YYYY-MM-DD) or `date-time` (ISO/TIMESTAMP) when you need formatting/coercion decisions.

## Decorators (optional)

- `@Entity({ tableName?, hooks? })` decorates a class and sets the table mapping.
- `@Column(options | ColumnDef)` registers a field as a column.
  - Options: `{ type, args?, notNull?, primary?, unique?, default?, autoIncrement?, dialectTypes?, tsType? }`.
- `@PrimaryKey(options | ColumnDef)` convenience for primary keys.
- `@HasMany({ target, foreignKey?, localKey?, cascade? })` (defaults `foreignKey` to `<RootEntity>_id` when omitted).
- `@HasOne({ target, foreignKey?, localKey?, cascade? })` (defaults `foreignKey` to `<RootEntity>_id` when omitted).
- `@BelongsTo({ target, foreignKey?, localKey?, cascade? })` (defaults `foreignKey` to `<property>_id` when omitted).
- `@BelongsToMany({ target, pivotTable, pivotForeignKeyToRoot?, pivotForeignKeyToTarget?, ... })` (defaults to `<RootEntity>_id`/`<TargetEntity>_id` when omitted).

Decorator metadata is stored in a registry. Use `bootstrapEntities()` to resolve all metadata:

- `bootstrapEntities()` resolves all decorator metadata into `TableDef` instances.
- `getTableDefFromEntity(MyEntity)` fetches the generated `TableDef`.
- `selectFromEntity(MyEntity)` starts a query builder from an entity class.
- `getDecoratorMetadata(MyEntity)` reads raw decorator metadata.

## Expressions & AST Utilities

### Operators
- **Comparison**: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `notLike`.
- **Logic**: `and`, `or`, `isNull`, `isNotNull`.
- **Arithmetic**: `add`, `sub`, `mul`, `div`.
- **Bitwise**: `bitAnd`, `bitOr`, `bitXor`, `shiftLeft`, `shiftRight`.
- **Collections**: `inList`, `notInList`, `inSubquery`, `notInSubquery`, `between`, `notBetween`.
- **Others**: `cast(expr, type)`, `collate(expr, collation)`, `jsonPath(col, path)`, `caseWhen(conditions, else?)`.

### Correlated Subqueries
- `outerRef(col)` marks a column as an outer-scope reference.
- `correlateBy(table, column)` shortcut for `outerRef({ table, name: column })`.
- `aliasRef(name)` references a SELECT alias.
- `asType<T>(expr)` annotates functions/case/window expressions with a compile-time-only type when the runtime node cannot infer it (e.g., `concat` or string literals).

### SQL Functions
- **Text**: `lower`, `upper`, `trim`, `ltrim`, `rtrim`, `substr`, `concat`, `concatWs`, `replace`, `left`, `right`, `ascii`, `char`, `chr`, `bitLength`, `octetLength`, `reverse`, `position`, `locate`, `instr`, `repeat`, `lpad`, `rpad`, `space`, `initcap`, `md5`, `sha1`, `sha2?`.
- **Numeric**: `abs`, `sign`, `mod`, `pi`, `acos`, `asin`, `atan`, `atan2`, `ceil`, `ceiling`, `cos`, `cot`, `degrees`, `exp`, `floor`, `ln`, `log`, `log10`, `log2`, `logBase`, `pow`, `power`, `radians`, `random`, `rand`, `round`, `sin`, `sqrt`, `cbrt`, `tan`, `trunc`, `truncate`.
- **Date & time**: `now`, `currentDate`, `currentTime`, `utcNow`, `localTime`, `localTimestamp`, `extract`, `year`, `month`, `day`, `hour`, `minute`, `second`, `quarter`, `dateAdd`, `dateSub`, `dateDiff`, `dateFormat`, `unixTimestamp`, `fromUnixTime`, `endOfMonth`, `dayOfWeek`, `weekOfYear`, `dateTrunc`, `age`.
- **Control Flow**: `coalesce`, `nullif`, `greatest`, `least`, `ifNull`.

### Aggregates
- `count`, `sum`, `avg`, `min`, `max`, `countAll`, `stddev`, `variance`.
- `groupConcat(col, options?)` supports `separator` and `orderBy`.

### Window Functions
- `rowNumber`, `rank`, `denseRank`, `ntile(n)`, `lag`, `lead`, `firstValue`, `lastValue`, `windowFunction(...)`.

## Query Builders

### Entry Points
- `selectFrom(table | entity)` - returns `SelectQueryBuilder`
- `insertInto(table | entity)` - returns `InsertQueryBuilder`
- `update(table | entity)` - returns `UpdateQueryBuilder`
- `deleteFrom(table | entity)` - returns `DeleteQueryBuilder`

### Selection Helpers
- `sel(table, ...names)` typed selection map for `TableDef`.
- `esel(Entity, ...props)` typed selection map for Entites.

### SelectQueryBuilder Details
- `select(...names)` (typed to include the requested columns), `select({ ... })` (merges alias keys into the result type), `selectRaw(...cols)`, `selectSubquery(alias, qb)` (use the generic form to keep the projected type).
- `with(name, qb)`, `withRecursive(name, qb)`.
- `fromFunctionTable(fn, args, alias, options?)`.
- `joinFunctionTable(fn, args, alias, condition?, kind?, options?)`.
- `where(expr)`, `whereExists(qb)`, `whereHas(relation, cb?)`.
- `innerJoin/leftJoin/rightJoin(table, condition)`.
- `match(relation, predicate?)`, `joinRelation(relation, kind?)`.
- `include(relation, options?)`, `includeLazy(relation, options?)`.
- `groupBy`, `having`, `orderBy`, `distinct`, `limit`, `offset`.
- `compile(dialect)`, `execute(session)`, `executePlain(session)`, `executeAs(Entity, session)`.

## Execution & Pooling

MetalORM provides a first-class pooling implementation and execution abstraction.

- `Pool<TConn>`: Generic resource pool with warmup, reaping, and timeouts.
- `createPooledExecutorFactory({ pool, adapter })`: Creates a `DbExecutorFactory` that manages pool leases automatically.
- `DbExecutor`: Interface for executing SQL and managing transactions.
  - `executeSql(sql, params)`
  - `beginTransaction()`, `commitTransaction()`, `rollbackTransaction()`

## ORM Runtime

- `Orm`: Central registry for tables and interceptors.
- `OrmSession`: Execution context for tracking entities and flushing changes.
  - `trackNew(entity)`, `trackManaged(entity)`.
  - `commit()` flushes all pending changes in a single transaction.
- **Relational Collections**:
  - `HasManyCollection` / `ManyToManyCollection`: `load()`, `getItems()`, `add(data)`, `attach(entity)`, `remove(entity)`, `detach(entity)`, `clear()`.
  - `BelongsToReference`: `load()`, `get()`, `set(entity)`, `clear()`.

## DDL & Introspection

- `generateSchemaSql(tables, dialect)` → SQL string array.
- `diffSchema(expected, actual, dialect)` → `SchemaPlan`.
- `synchronizeSchema(...)` performs the diff and executes migration SQL.
- `introspectSchema(executor, dialect)` → `DatabaseSchema` object.
