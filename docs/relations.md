# Relations in Metal ORM

> **⚠️ Documentation Moved**
> 
> This file has been reorganized into smaller, focused documents. The comprehensive relations documentation is now available in the `/docs/relations/` directory.

## Quick Access

📖 **[Complete Relations Documentation](./relations/)**

The relations documentation has been divided into the following sections:

1. [Overview](./relations/01-overview.md) - Introduction to Metal ORM relations
2. [Relation Types](./relations/02-relation-types.md) - HasMany, HasOne, BelongsTo, BelongsToMany
3. [Defining Relations](./relations/03-defining-relations.md) - Schema-based and decorator approaches
4. [Decorators](./relations/04-decorators.md) - Complete decorator reference
5. [Runtime Implementation](./relations/05-runtime-implementation.md) - Runtime classes and methods
6. [Query Builder Integration](./relations/06-query-builder-integration.md) - Includes, joins, and matching
7. [SQL Generation Analysis](./relations/07-sql-generation-analysis.md) - Understanding generated SQL
8. [Lazy Loading](./relations/08-lazy-loading.md) - Batch loading and caching
9. [Cascade Operations](./relations/09-cascade-operations.md) - Automatic operation propagation
10. [Entity Management](./relations/10-entity-management.md) - Change tracking and unit of work
11. [Examples](./relations/11-examples.md) - Complete blog and social media examples
12. [Best Practices](./relations/12-best-practices.md) - Performance and usage recommendations
13. [SQL Examples Appendix](./relations/appendix-sql-examples.md) - Complete SQL reference

## Key Features

Metal ORM provides a robust relations system with:

- **Type Safety**: Full TypeScript support with compile-time type checking
- **Lazy Loading**: Efficient batch loading of related entities  
- **Change Tracking**: Automatic tracking of relation changes
- **Cascade Operations**: Configurable cascade behavior
- **Query Integration**: Seamless integration with the query builder

## Relation Types

- **HasMany**: One-to-many relationships
- **HasOne**: One-to-one relationships where the child has the foreign key
- **BelongsTo**: Many-to-one relationships  
- **BelongsToMany**: Many-to-many relationships with pivot table support

Visit the [main documentation](./relations/) for detailed examples and implementation guides.