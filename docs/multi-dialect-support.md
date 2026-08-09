# Multi-Dialect Support

MetalORM is database-agnostic at the query/runtime boundary. `Dialect` is a structural contract assembled from independent compiler components; inheritance is not part of the dialect architecture.

## Built-in dialects

Each backend exposes both a pure factory and a constructor facade:

- MySQL: `createMySqlDialect()` / `new MySqlDialect()`
- SQLite: `createSqliteDialect()` / `new SqliteDialect()`
- SQL Server: `createSqlServerDialect()` / `new SqlServerDialect()`
- PostgreSQL: `createPostgresDialect()` / `new PostgresDialect()`

The classes do not extend a MetalORM base class. They only delegate to the same composed dialect objects returned by the factories.

```typescript
const query = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(eq(users.columns.id, 1))
  .limit(10);

const postgres = query.compile(createPostgresDialect());
const sqlite = query.compile(new SqliteDialect());
```

`DialectFactory` itself uses the pure factories, so normal runtime resolution does not instantiate an inheritance hierarchy.

## `Dialect` is only a contract

```typescript
export interface Dialect
  extends SelectCompiler, InsertCompiler, UpdateCompiler, DeleteCompiler {
  quoteIdentifier(id: string): string;
  supportsDmlReturningClause(): boolean;
}
```

There is no `DialectBase` or `SqlDialectBase`. A backend can be a plain object, a factory result, or an optional facade class.

## `createSqlDialect()`

`createSqlDialect()` is the standard assembly API. It owns the reusable plumbing that used to require inheritance:

- parameter context creation;
- `ExpressionCompilerRegistry`;
- `SelectAstNormalizer`;
- function and table-function strategies;
- source compilation;
- SELECT/INSERT/UPDATE/DELETE compiler assembly;
- pagination;
- UPSERT;
- RETURNING/OUTPUT;
- backend expression overrides.

A small custom dialect can therefore reuse the complete standard SQL compiler without subclassing anything:

```typescript
const custom = createSqlDialect({
  name: 'sqlite',
  quoteIdentifier: id => `"${id}"`,
  formatPlaceholder: index => `$${index}`,
  supportsDmlReturning: false
});

DialectFactory.register('custom', () => custom);
```

For advanced composition, `composeSqlDialect()` also returns `runtime` services used by optional backend capabilities such as stored procedures.

```typescript
const composition = composeSqlDialect(config);
const procedures = new PostgresProcedureCompiler(composition.runtime);

const dialect: Dialect & ProcedureCompiler = {
  ...composition.dialect,
  compileProcedureCall: ast => procedures.compileProcedureCall(ast)
};
```

## Compiler set

The standard implementation is still split by query responsibility:

- `StandardSelectCompiler`
- `StandardInsertCompiler`
- `StandardUpdateCompiler`
- `StandardDeleteCompiler`
- `StandardSqlSourceCompiler`

`SqlCompilerFactory` can replace only the grammar that differs. SQL Server uses this to provide its own SELECT/INSERT/UPDATE/DELETE compilers:

```typescript
export const createMssqlCompilerSet: SqlCompilerFactory = ({ services, sources }) => ({
  select: new MssqlSelectCompiler(services, sources),
  insert: new MssqlInsertCompiler(services, sources),
  update: new MssqlUpdateCompiler(services, sources),
  delete: new MssqlDeleteCompiler(services, sources)
});
```

No SQL Server query compiler depends on a `SqlServerDialect` superclass.

## UPSERT and RETURNING strategies

Backend-specific mutation syntax is independent from query orchestration:

- `MySqlUpsertStrategy`
- `PostgresUpsertStrategy`
- `SqliteUpsertStrategy`
- `PostgresReturningStrategy`
- `SqliteReturningStrategy`
- `MssqlOutputStrategy`

They are selected declaratively in the composer configuration rather than through method overrides.

## Expression specialization

Backends can replace individual expression/operand compilers through `configureExpressions`:

```typescript
composeSqlDialect({
  name: 'postgres',
  quoteIdentifier,
  configureExpressions(api) {
    api.registerOperandCompiler('BitwiseExpression', (node, ctx) => {
      const left = api.compileOperand(node.left, ctx);
      const right = api.compileOperand(node.right, ctx);
      const operator = node.operator === '^' ? '#' : node.operator;
      return `(${left} ${operator} ${right})`;
    });
  }
});
```

This replaces AST behavior without subclass overrides or backend switches in the generic compiler.

## Optional procedures

Stored procedures remain a structural optional capability. PostgreSQL, MySQL and SQL Server attach a dedicated compiler to the composed dialect; SQLite simply lacks that capability.

- `MySqlProcedureCompiler`
- `PostgresProcedureCompiler`
- `MssqlProcedureCompiler`

Each consumes only `ProcedureCompilerServices`, which is supplied by `composeSqlDialect().runtime`.

```typescript
if (isProcedureCompiler(dialect)) {
  const compiled = dialect.compileProcedureCall(ast);
}
```

## Responsibility map

```text
Dialect                         structural public contract
|
+-- createSqlDialect()          pure assembly
|   +-- ExpressionCompilerRegistry
|   +-- SelectAstNormalizer
|   +-- StandardSqlSourceCompiler
|   +-- SqlCompilerSet
|   |   +-- SelectCompiler
|   |   +-- InsertCompiler
|   |   +-- UpdateCompiler
|   |   +-- DeleteCompiler
|   +-- PaginationStrategy
|   +-- ReturningStrategy
|   +-- UpsertStrategy
|   +-- FunctionStrategy
|   +-- TableFunctionStrategy
|
+-- optional capabilities
    +-- ProcedureCompiler

backend composition
+-- MySQL strategies + procedure compiler
+-- PostgreSQL strategies + procedure compiler
+-- SQLite strategies
+-- MSSQL compiler set + output strategy + procedure compiler
```

The built-in constructor classes exist only as ergonomic API facades. They are not extension points and contain no SQL compilation architecture.
