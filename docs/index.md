# Introduction to MetalORM

MetalORM is a TypeScript-first SQL query builder designed for developers who want the power of raw SQL with the convenience of a modern ORM. It keeps SQL generation deterministic (CTEs, aggregates, window functions, EXISTS/subqueries) while letting you introspect the AST or reuse builders inside larger queries.

## Philosophy

MetalORM follows these core principles:

- **Type Safety First**: Leverage TypeScript to catch errors at compile time
- **SQL Transparency**: Generate predictable, readable SQL that you can inspect
- **Composition Over Configuration**: Build complex queries by composing simple parts
- **Zero Magic**: Explicit operations with clear AST representation
- **Multi-Dialect Support**: Write once, compile to MySQL, SQLite, PostgreSQL, or SQL Server

## Features

- **Declarative Schema Definition**: Define your database structure in TypeScript with full type inference.
- **Rich Query Building**: A fluent API to build simple and complex queries.
- **Advanced SQL Features**: Support for CTEs, window functions, subqueries, and more.
- **Relation Hydration**: Automatically transform flat database rows into nested JavaScript objects.
- **Multi-Dialect Support**: Compile the same query to different SQL dialects.
- **DML Operations**: Full support for INSERT, UPDATE, and DELETE operations.
- **Comprehensive Relation Support**: One-to-many, many-to-one, and many-to-many relationships.

## Table of Contents

- [Getting Started](./getting-started.md)
- [Schema Definition](./schema-definition.md)
- [Query Builder](./query-builder.md)
- [DML Operations](./dml-operations.md) *(New!)*
- [Advanced Features](./advanced-features.md)
- [Hydration](./hydration.md)
- [Multi-Dialect Support](./multi-dialect-support.md)
- [API Reference](./api-reference.md)
