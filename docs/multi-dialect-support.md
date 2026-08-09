# Multi-Dialect Support

MetalORM is database-agnostic at the query/runtime boundary. Builders depend on the structural `Dialect` contract rather than on a concrete inheritance hierarchy.

## Built-in dialects

- **MySQL**: `MySqlDialect`
- **SQLite**: `SqliteDialect`
- **SQL Server**: `SqlServerDialect`
- **PostgreSQL**: `PostgresDialect`

The concrete classes are assembly points. SQL query orchestration, UPSERT, RETURNING/OUTPUT and stored-procedure compilation live in independent components.

## Compiling queries

```typescript
const query = new SelectQueryBuilder(users)
  .selectRaw('*')
  .where(eq(users.columns.id, 1))
  .limit(10);

const mysql = query.compile(new MySqlDialect());
const sqlite = query.compile(new SqliteDialect());
const mssql = query.compile(new SqlServerDialect());
const postgres = query.compile(new PostgresDialect());
```

The same dialect object drives SELECT compilation and runtime INSERT/UPDATE/DELETE behavior through `Orm` / `OrmSession`.

## Dialect is a contract, not a superclass

`Dialect` is an interface containing the compiler operations required by every backend. Inheritance is optional.

```typescript
import type { Dialect } from 'metal-orm';
import { DialectFactory } from 'metal-orm';

const customDialect: Dialect = {
  quoteIdentifier: id => `"${id}"`,
  supportsDmlReturningClause: () => false,
  compileSelect: ast => compileCustomSelect(ast),
  compileInsert: ast => compileCustomInsert(ast),
  compileUpdate: ast => compileCustomUpdate(ast),
  compileDelete: ast => compileCustomDelete(ast)
};

DialectFactory.register('custom', () => customDialect);
```

`DialectBase` and `SqlDialectBase` are implementation conveniences, not required extension points.

## Standard compiler composition

The common SQL implementation is exposed as independent components:

- `StandardSelectCompiler`
- `StandardInsertCompiler`
- `StandardUpdateCompiler`
- `StandardDeleteCompiler`
- `StandardSqlSourceCompiler`
- `StandardSqlCompilerServices`

They depend only on narrow callback contracts and do not import a concrete dialect class.

```typescript
const services: StandardSqlCompilerServices = {
  getDialectName: () => 'custom' as DialectName,
  getPaginationStrategy: () => pagination,
  getTableFunctionStrategy: () => tableFunctions,
  quoteIdentifier,
  compileOperand,
  compileExpression,
  compileOrderingTerm,
  normalizeSelectAst,
  compileSelectAst,
  compileReturning,
  compileUpsertClause,
  compileSetTarget,
  renderOrderByNulls,
  renderOrderByCollation
};

const sources = new StandardSqlSourceCompiler(services);
const select = new StandardSelectCompiler(services, sources);
const insert = new StandardInsertCompiler(services, sources);
const update = new StandardUpdateCompiler(services, sources);
const remove = new StandardDeleteCompiler(services, sources);
```

## Pluggable compiler sets

`SqlDialectBase` assembles a `SqlCompilerSet`. A backend can replace only the query compilers whose grammar is genuinely different through `SqlCompilerFactory`.

SQL Server uses this mechanism for all four query types:

```typescript
export const createMssqlCompilerSet: SqlCompilerFactory = ({ services, sources }) => ({
  select: new MssqlSelectCompiler(services, sources),
  insert: new MssqlInsertCompiler(services, sources),
  update: new MssqlUpdateCompiler(services, sources),
  delete: new MssqlDeleteCompiler(services, sources)
});
```

`SqlServerDialect` therefore does not contain SELECT pagination, MERGE, UPDATE JOIN or DELETE OUTPUT orchestration. It selects those components declaratively.

## UPSERT and RETURNING strategies

Conflict handling and mutation result syntax are independent strategies:

- `MySqlUpsertStrategy`
- `PostgresUpsertStrategy`
- `SqliteUpsertStrategy`
- `PostgresReturningStrategy`
- `SqliteReturningStrategy`
- `MssqlOutputStrategy`

A built-in dialect configures them when calling `SqlDialectBase` rather than overriding large DML methods.

```typescript
super({
  functionStrategy: new PostgresFunctionStrategy(),
  tableFunctionStrategy: new PostgresTableFunctionStrategy(),
  returningStrategy: new PostgresReturningStrategy(),
  upsertStrategy: new PostgresUpsertStrategy(),
  supportsDmlReturning: true
});
```

## Optional procedure capability

Stored procedures remain an optional capability. PostgreSQL, MySQL and SQL Server implement `ProcedureCompiler`; SQLite does not.

The backend SQL is itself split into reusable components:

- `MySqlProcedureCompiler`
- `PostgresProcedureCompiler`
- `MssqlProcedureCompiler`

Each consumes only `ProcedureCompilerServices`: identifier quoting, compiler-context creation and operand compilation. The concrete dialect exposes the capability by delegating to its component.

```typescript
const procedureCompiler = new MssqlProcedureCompiler({
  quoteIdentifier,
  createCompilerContext,
  compileOperand
});
```

Callers discover the capability structurally:

```typescript
if (isProcedureCompiler(dialect)) {
  const compiled = dialect.compileProcedureCall(ast);
}
```

SQLite simply lacks the capability; it does not implement a fake method that only throws.

## Responsibility map

```text
Dialect                         public contract
|
+-- DialectBase                 low-level assembly
|   +-- ExpressionCompilerRegistry
|   +-- SelectAstNormalizer
|
+-- SqlDialectBase              component assembly facade
    +-- SqlCompilerSet
    |   +-- StandardSelectCompiler
    |   +-- StandardInsertCompiler
    |   +-- StandardUpdateCompiler
    |   +-- StandardDeleteCompiler
    |
    +-- StandardSqlSourceCompiler
    +-- PaginationStrategy
    +-- ReturningStrategy
    +-- UpsertStrategy

optional/backend pieces
+-- ProcedureCompiler
+-- MssqlSelectCompiler
+-- MssqlInsertCompiler
+-- MssqlUpdateCompiler
+-- MssqlDeleteCompiler
```

Concrete built-in dialects now retain only intrinsic syntax such as identifier quoting, placeholders, JSON-path rendering and a few expression/SET-target differences.
