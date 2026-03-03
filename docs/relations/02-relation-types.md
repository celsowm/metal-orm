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

## MorphOne (Polymorphic One-to-One)

A MorphOne relationship represents a polymorphic one-to-one connection where multiple parent types can each have one child from a shared morph table.

**Characteristics:**
- Defined on the "parent" side of the relationship
- Child table contains a type discriminator column and a foreign key column
- Returns a single related entity or null (uses `HasOneReference` API)
- JOINs include an extra `AND` condition on the discriminator column

**Example Use Case:** A User has one Image, a Post has one Image (both stored in the same `images` table)

## MorphMany (Polymorphic One-to-Many)

A MorphMany relationship represents a polymorphic one-to-many connection where multiple parent types can each have multiple children from a shared morph table.

**Characteristics:**
- Defined on the "parent" side of the relationship
- Child table contains a type discriminator column and a foreign key column
- Returns a collection of related entities (uses `HasManyCollection` API)
- JOINs include an extra `AND` condition on the discriminator column

**Example Use Case:** A Post has many Comments, a Video has many Comments (both stored in the same `comments` table)

## MorphTo (Polymorphic Inverse)

A MorphTo relationship represents the inverse of MorphOne/MorphMany — a child that can belong to different parent types.

**Characteristics:**
- Defined on the "child" (morph) side of the relationship
- The child entity reads its type discriminator to determine which parent table to query
- Target table is resolved dynamically at runtime
- Does **not** support JOIN-based include; uses batch loading instead
- Returns a single parent entity or null (uses `BelongsToReference` API)

**Example Use Case:** A Comment belongs to either a Post or a Video

See [Polymorphic Relations](./14-polymorphic-relations.md) for full documentation and examples.