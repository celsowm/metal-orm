# Stored Procedures

MetalORM provides a fluent API for stored procedure execution with `IN`, `OUT`, and `INOUT` parameters.

## Quick Start

```ts
import { callProcedure } from 'metal-orm';

const result = await callProcedure('rebuild_cache', { schema: 'public' })
  .in('tenantId', 10)
  .out('totalRows')
  .inOut('cursor', 1)
  .execute(session);

console.log(result.resultSets);
console.log(result.out.totalRows);
console.log(result.out.cursor);
```

## Builder API

- `callProcedure(name, opts?)`
- `.in(name, value)`
- `.out(name, { dbType? })`
- `.inOut(name, value, { dbType? })`
- `.compile(dialect)`, `.toSql(dialect)`, `.getAST()`, `.execute(session)`

Execution returns:

```ts
{
  resultSets: QueryResult[],
  out: Record<string, unknown>
}
```

## ProcedureCompiler capability

Stored procedures are an optional dialect capability rather than a mandatory method on every `Dialect`.

```ts
import {
  isProcedureCompiler,
  type Dialect,
  type ProcedureCompiler
} from 'metal-orm';

function canCallProcedures(
  dialect: Dialect
): dialect is Dialect & ProcedureCompiler {
  return isProcedureCompiler(dialect);
}
```

PostgreSQL, MySQL and SQL Server implement `ProcedureCompiler`. SQLite does not. Unsupported calls are rejected at the capability boundary; SQLite no longer carries a fake `compileProcedureCall()` implementation whose only purpose is to throw.

Backend-specific validation also belongs to the capability implementation. For example, the SQL Server compiler itself enforces `dbType` for `OUT`/`INOUT`; the generic procedure builder does not inspect concrete dialect class names.

## Dialect Matrix

- `postgres`
  - Uses `CALL schema.proc(...)`.
  - `OUT`/`INOUT` values are read from the **first** result set.
- `mysql`
  - Uses `CALL ...` plus a trailing `SELECT` for OUT variables.
  - `OUT`/`INOUT` values are read from the **last** result set.
- `mssql`
  - Uses `DECLARE ...; EXEC ... OUTPUT; SELECT ...`.
  - `OUT`/`INOUT` values are read from the **last** result set.
  - `dbType` is required for `OUT` and `INOUT`.
- `sqlite`
  - Not supported. Calling compile/execute throws an explicit capability error.

## Operational Notes

- MySQL:
  - Procedure compilation emits multiple statements when OUT/INOUT are present.
  - Your driver/connection must allow multi-statement execution and multiple result sets.
- MSSQL:
  - Always pass `dbType` for `.out(...)` and `.inOut(...)`, for example `{ dbType: 'INT' }`.

## Low-Level Executor Note

- `DbExecutor.executeSql(...)` returns an internal `ExecutionPayload` (array-compatible), with canonical `resultSets`.
- Custom executors should preserve all result sets in `payload.resultSets`.
- Interceptors and low-level integrations that assumed a single set should explicitly use the first set only where that behavior is intended.
