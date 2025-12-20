# Relations in Metal ORM

This directory contains a comprehensive guide to relations in Metal ORM, covering all aspects from basic concepts to advanced usage patterns.

## Table of Contents

1. [Overview](./01-overview.md)
2. [Relation Types](./02-relation-types.md)
3. [Defining Relations](./03-defining-relations.md)
4. [Decorators](./04-decorators.md)
5. [Runtime Implementation](./05-runtime-implementation.md)
6. [Query Builder Integration](./06-query-builder-integration.md)
7. [SQL Generation Analysis](./07-sql-generation-analysis.md)
8. [Lazy Loading](./08-lazy-loading.md)
9. [Cascade Operations](./09-cascade-operations.md)
10. [Entity Management](./10-entity-management.md)
11. [Examples](./11-examples.md)
12. [Best Practices](./12-best-practices.md)
13. [Appendix: SQL Examples](./appendix-sql-examples.md)

## Quick Start

Metal ORM provides a robust relations system that supports four main types of relationships between entities:

- **HasMany**: One-to-many relationships
- **HasOne**: One-to-one relationships where the child has the foreign key
- **BelongsTo**: Many-to-one relationships
- **BelongsToMany**: Many-to-many relationships with pivot table support

## Key Features

- **Type Safety**: Full TypeScript support with compile-time type checking
- **Lazy Loading**: Efficient batch loading of related entities
- **Change Tracking**: Automatic tracking of relation changes
- **Cascade Operations**: Configurable cascade behavior
- **Query Integration**: Seamless integration with the query builder

Navigate to the specific sections above to learn more about each aspect of the relations system.