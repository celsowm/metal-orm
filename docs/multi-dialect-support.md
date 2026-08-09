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

## Standard compiler composition

The standard SQL implementation is not one monolithic `SqlDialectBase` compiler. Its query orchestration is exposed as independent components:

- `StandardSelectCompiler`
- `StandardInsertCompiler`
- `StandardUpdateCompiler`
- `StandardDeleteCompiler`
- `StandardSqlSourceCompiler`
- `StandardSqlCompilerServices`

These components depend only on the narrow `StandardSqlCompilerServices` callback contract. They do not import `SqlDialectBase` or any concrete dialect class.

`SqlDialectBase` is therefore only an assembly facade: it creates the standard compiler objects and wires dialect-specific hooks such as identifier quoting, parameter/expression rendering, pagination, RETURNING, UPSERT and SET-target syntax into them.

A custom backend can use the same components directly without inheritance:

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

This allows replacing one query compiler without inheriting or overriding unrelated SELECT/DML behavior.

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

The reusable implementation is split by responsibility:

- `ExpressionCompilerRegistry` owns expression/operand dispatch and dialect overrides for individual AST node types;
- `SelectAstNormalizer` owns set-operation validation and CTE hoisting;
- `StandardSelectCompiler`, `StandardInsertCompiler`, `StandardUpdateCompiler` and `StandardDeleteCompiler` own query-type orchestration;
- `StandardSqlSourceCompiler` owns table/source/derived-table rendering shared by the query compilers;
- `FunctionTableFormatter` receives explicit formatting callbacks instead of depending on `SqlDialectBase`;
- pagination, RETURNING, CTE, JOIN, GROUP BY and ORDER BY remain independent strategies/compilers.

`DialectBase` coordinates low-level compiler infrastructure while `SqlDialectBase` only assembles the standard SQL components. Neither is the public dialect contract.

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
