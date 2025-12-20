# Overview

Metal ORM provides a robust relations system that supports four main types of relationships between entities:

- **HasMany**: One-to-many relationships
- **HasOne**: One-to-one relationships where the child has the foreign key
- **BelongsTo**: Many-to-one relationships
- **BelongsToMany**: Many-to-many relationships with pivot table support

The relations system is built with several key features:

- **Type Safety**: Full TypeScript support with compile-time type checking
- **Lazy Loading**: Efficient batch loading of related entities
- **Change Tracking**: Automatic tracking of relation changes
- **Cascade Operations**: Configurable cascade behavior
- **Query Integration**: Seamless integration with the query builder