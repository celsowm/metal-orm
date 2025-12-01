📚 ORM QUERY BUILDER - FEATURE MAP
├── 🏁 INITIALIZATION & SCOPE
│ ├── Table Targeting
│ ├── Model/Entity Context
│ └── Alias Definition
│
├── 🎯 PROJECTION (SELECTION)
│ ├── Specific Columns
│ ├── Raw Expressions
│ ├── Aggregations (Count, Sum, Avg, Max, Min)
│ └── Deduplication (Distinct)
│
├── 🔗 RELATIONSHIP QUERIES (CARDINALITY)
│ ├── One-to-Many (1:N)
│ │ ├── Parent to Children (HasMany)
│ │ │ ├── Eager Loading Children
│ │ │ ├── Filtering Children (e.g., "only active posts")
│ │ │ └── Aggregating Children (e.g., "count comments")
│ │ └── Child to Parent (BelongsTo)
│ │ ├── Eager Loading Parent
│ │ ├── Filtering by Parent Attributes
│ │ └── Associating/Disassociating (FK management)
│ │
│ └── Many-to-Many (N:N)
│ ├── BelongsToMany (Junction/Pivot Logic)
│ │ ├── Eager Loading Related Records
│ │ └── Querying Existence (Has related records)
│ └── Pivot Table Context (Intermediate Table)
│ ├── Pivot Columns Selection (Retrieving extra data from junction)
│ ├── Pivot Filtering (Where Pivot...)
│ └── Pivot Sorting (Order by Pivot...)
│
├── 🧠 COMPLEX QUERIES & NESTING
│ ├── Subqueries
│ │ ├── Scalar Subqueries (Select clause)
│ │ ├── Derived Tables (From clause)
│ │ └── Join Subqueries
│ ├── Correlated Subqueries
│ │ ├── Parent Scope Reference
│ │ └── Existence Checks (Exists / Not Exists)
│ ├── Common Table Expressions (CTEs)
│ │ ├── Standard CTEs (With)
│ │ └── Recursive CTEs
│ └── Conditional Logic (Case When / Coalesce)
│
├── 🤝 PHYSICAL JOINS (SQL LAYER)
│ ├── Standard Joins (Inner, Left, Right)
│ ├── Cross Joins (Cartesian)
│ ├── Lateral Joins
│ └── Polymorphic Joins (On Type + ID)
│
├── 🔍 FILTERING (CONSTRAINTS)
│ ├── Basic Operators
│ ├── Logical Grouping (Nested AND/OR)
│ ├── Null Handling
│ ├── Set Membership (In / Not In)
│ ├── Pattern Matching (Like / RegEx)
│ ├── JSON Path Filtering
│ └── Relationship Existence (Where Has / Where Doesnt Have)
│
├── 📊 GROUPING & AGGREGATION
│ ├── Group By
│ ├── Having
│ └── Window Functions (Over / Partition By)
│
├── 🔢 SORTING & LIMITING
│ ├── Order By (Column / Raw)
│ └── Pagination (Limit, Offset, Cursor)
│
├── 🛠️ UTILITIES & OPERATIONS
│ ├── Set Operations (Union, Intersect, Except)
│ ├── Locking (For Update)
│ └── Parameter Binding
│
└── 🚀 EXECUTION & RETRIEVAL
├── Fetch Collection
├── Fetch Single
├── Chunking / Streaming
└── Debugging (SQL Dump)
ATTENTION: ALWAYS SOLID AND ALWAYS PERFORMATIC

Here is the comprehensive specification and the subsequent code updates to implement the Roadmap visualization and the first phase of the ORM feature expansion (Sorting & Grouping).
📋 Specification: MetalORM Evolution Plan
To achieve the "Feature Map" you provided while maintaining high performance ("close-to-metal"), we will structure the development into 4 Phases.
Phase 1: The Foundation & Aggregation (Current Step)
Goal: Enhance the basic query builder to support analytical queries.
Updates:
UI: Create a Roadmap visualization page to track this feature map.
UI: Refactor App.tsx to support navigation between Playground, Roadmap, Architecture, and Benchmarks.
ORM Core: Implement ORDER BY and GROUP BY in the AST.
ORM Core: Implement COUNT, SUM helpers.
Scenario: Add a "Sales Analytics" scenario to the playground.
Phase 2: Relationships & Cardinality
Goal: Implement the "Graph" aspect of the Object-Relational Mapper.
Technical Approach:
Introduce RelationDef in the schema definition.
Implement with() method in Builder for Eager Loading (1 query + 1 query per relation level, stitched in memory to avoid N+1).
Support innerJoin(relationName) shorthand.
Phase 3: Advanced Filtering & Subqueries
Goal: Support complex business logic constraints.
Technical Approach:
Refactor WHERE clause AST to support recursive BinaryExpressionNodes (nested AND/OR).
Implement whereHas (exists subquery generation).
Implement Subquery class that implements the TableNode interface (Derived Tables).
Phase 4: Window Functions & CTEs
Goal: Support analytical depth.
Technical Approach:
Add OVER (PARTITION BY ...) support to projection nodes.
Add WITH clause support to the root SelectQueryNode.
💻 Code Changes
The following changes implement Phase 1:
New Roadmap UI: Visualizes the feature tree you provided.
Navigation: Integrates existing (unused) Architecture/Benchmark components.
ORM Upgrade: Adds orderBy, groupBy to the AST and Dialects.
New Scenario: Demonstrates the new aggregation features.