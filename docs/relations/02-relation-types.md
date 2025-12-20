# Relation Types

## HasMany (One-to-Many)

A HasMany relationship represents a one-to-many connection where one entity can have multiple related entities.

**Characteristics:**
- Defined on the "one" side of the relationship
- Child entities contain the foreign key
- Returns a collection of related entities

**Example Use Case:** A User can have multiple Posts

## HasOne (One-to-One)

A HasOne relationship represents a one-to-one connection where one entity has exactly one related entity.

**Characteristics:**
- Defined on the "parent" side of the relationship
- Child entity contains the foreign key
- Returns a single related entity or null

**Example Use Case:** A User has one Profile

## BelongsTo (Many-to-One)

A BelongsTo relationship represents the inverse of HasMany/HasOne, where an entity belongs to another entity.

**Characteristics:**
- Defined on the "many" side of the relationship
- Contains the foreign key
- Returns a single parent entity or null

**Example Use Case:** A Post belongs to a User

## BelongsToMany (Many-to-Many)

A BelongsToMany relationship represents a many-to-many connection through a pivot table.

**Characteristics:**
- Requires a pivot table with foreign keys to both entities
- Supports additional pivot table columns
- Returns a collection of related entities

**Example Use Case:** Users can have multiple Roles, and Roles can belong to multiple Users