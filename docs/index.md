# Introduction to MetalORM

MetalORM is a TypeScript-first SQL toolkit that can be used as:

1. A **typed query builder** over a real SQL AST.
2. A **hydration layer** for turning flat rows into nested objects.
3. An optional **entity runtime** with lazy relations and a Unit of Work.

You can adopt these layers independently, in this order.

## Philosophy

- **Type Safety First** – rely on TypeScript to catch mistakes early.:contentReference[oaicite:8]{index=8}
- **SQL Transparency** – inspect the AST and generated SQL at any time.
- **Composition Over Configuration** – build complex queries from small, pure pieces.
- **Zero Magic, Opt-in Runtime** – the query builder and ORM runtime are separate layers.
- **Multi-Dialect** – MySQL, PostgreSQL, SQLite, SQL Server out of the box.:contentReference[oaicite:9]{index=9}

## Features

- Declarative schema definition with relations.
- Fluent query builder, including CTEs, window functions, subqueries, JSON, CASE.  
- Relation hydration from flat result sets.
- Optional entity runtime + Unit of Work.

## Ordering & grouping expressions

- ORDER BY / GROUP BY now accept full expressions (e.g., `(a + b)`), SELECT aliases via `aliasRef`, collations, and `NULLS FIRST/LAST`.
- Works across dialects; unsupported null ordering will emit SQL anyway, so keep dialect quirks in mind.
- Example:
  ```ts
  db.select({ name: users.columns.name })
    .orderBy(add(users.columns.age, users.columns.score), { direction: 'DESC', nulls: 'LAST' })
    .orderBy(aliasRef('name'), { collation: 'NOCASE' });
  ```

## Table of Contents

- [Getting Started](./getting-started.md)
- [Schema Definition](./schema-definition.md)
- [Schema Generation (DDL)](./schema-generation.md)
- [Entity Generation from Schema](./generate-entities.md)
- [Query Builder](./query-builder.md)
- [Pagination](./pagination.md)
- [Transactions](./transactions.md)
- [Save Graph](./save-graph.md)
- [DB ➜ TypeScript type mapping](./db-to-ts-types.md)
- [Connection Pooling](./pooling.md)
- [SQL Functions](./sql-functions.md)
- [Function Registry](./function-registry.md)
- [DML Operations](./dml-operations.md)
- [Level 3 Backend Tutorial](./level-3-backend-tutorial.md)
- [Hydration & Entities](./hydration.md)
- [Runtime & Unit of Work](./runtime.md)
- [Advanced Features](./advanced-features.md)
- [Naming Strategy](./naming-strategy.md)
- [Multi-Dialect Support](./multi-dialect-support.md)
- [SQL Logging and Retrieval](./logging-and-sql.md)
- [API Reference](./api-reference.md)
