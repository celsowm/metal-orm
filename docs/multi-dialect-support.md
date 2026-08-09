# Multi-Dialect Support

MetalORM is database-agnostic at the query/runtime boundary. Builders depend on the structural `Dialect` contract rather than on a concrete inheritance hierarchy.

## Built-in dialects

- **MySQL**: `MySqlDialect`
- **SQLite**: `SqliteDialect`
- **SQL Server**: `SqlServerDialect`
- **PostgreSQL**: `PostgresDialect`

Each implementation owns only the syntax and optional capabilities supported by its backend.

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

`DialectBase` and `SqlDialectBase` are implementation conveniences for dialects that want to reuse MetalORM's compiler infrastructure. They are not required extension points.

This separation lets a backend replace one compiler strategy, compose an implementation from independent pieces, or reuse the standard SQL compiler without making unrelated features mandatory.

## Optional capabilities

Backend-specific features do not belong to the universal `Dialect` contract.

Stored procedures are represented by the `ProcedureCompiler` capability. PostgreSQL, MySQL and SQL Server implement it; SQLite does not.

```typescript
import {
  isProcedureCompiler,
  type Dialect,
  type ProcedureCompiler
} from 'metal-orm';

function supportsProcedures(
  dialect: Dialect
): dialect is Dialect & ProcedureCompiler {
  return isProcedureCompiler(dialect);
}
```

A custom dialect can add the capability through composition:

```typescript
const proceduralDialect: Dialect & ProcedureCompiler = {
  ...customDialect,
  compileProcedureCall(ast) {
    return compileCustomProcedure(ast);
  }
};
```

Callers use capability discovery rather than checking concrete class names. In particular, procedure builders do not contain MSSQL-specific `constructor.name` checks; SQL Server parameter validation lives in the SQL Server procedure compiler itself.

## Internal compiler composition

The reusable base implementation is also split by responsibility:

- `ExpressionCompilerRegistry` owns expression/operand dispatch and dialect overrides for individual AST node types;
- `SelectAstNormalizer` owns set-operation validation and CTE hoisting;
- `FunctionTableFormatter` receives explicit formatting callbacks instead of depending on `SqlDialectBase`;
- pagination, RETURNING, CTE, JOIN, GROUP BY and ORDER BY remain independent strategies/compilers.

This keeps `DialectBase` as coordination infrastructure rather than a second all-purpose SQL engine.

## Dialect-specific features

```typescript
const query = new SelectQueryBuilder(users)
  .select({
    id: users.columns.id,
    name: users.columns.name,
    settings: jsonPath(users.columns.settings, '$.notifications')
  })
  .compile(new PostgresDialect());
```

Dialect-specific rendering remains behind the same AST. Unsupported optional features fail at their capability boundary instead of forcing every backend to implement methods that only throw.
