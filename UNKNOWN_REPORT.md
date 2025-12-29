# Report: Analysis of `unknown` Types in Metal ORM Codebase

## Executive Summary

I have analyzed the Metal ORM codebase and identified all instances of `unknown` types. The analysis reveals **300+ occurrences** of `unknown` across different categories. This report categorizes these usages and identifies potential candidates for type improvement.

## Categories of `unknown` Usage

### 1. Database Execution and Query Results (45+ instances)

**Purpose**: Represents dynamic database query results and parameters
**Files**: `src/core/execution/`, `tests/execution/`

**Key Patterns**:
- `Record<string, unknown>` - Database row representations
- `unknown[]` - Query parameters and result arrays
- `Array<Record<string, unknown>>` - Query result sets

**Examples**:
```typescript
// Database row representation
type Row = Record<string, unknown>;

// Query parameters
executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;

// Result sets
Promise<Array<Record<string, unknown>>>
```

**Improvement Potential**: ⭐⭐⭐⭐⭐ HIGH
- Could use generic type parameters for table-specific row types
- Query parameters could be typed based on query structure

### 2. Entity Hydration and Materialization (35+ instances)

**Purpose**: Represents entity data during hydration process
**Files**: `src/orm/hydration.ts`, `src/orm/entity-materializer.ts`, `src/orm/entity-hydration.ts`

**Key Patterns**:
- `Record<string, unknown>` - Raw entity data from database
- Entity property access and manipulation
- Hydration cache storage

**Examples**:
```typescript
// Entity hydration
hydrateRows(rows: Record<string, unknown>[], plan?: HydrationPlan): Record<string, unknown>[];

// Entity materialization
materialize<T>(ctor: EntityConstructor<T>, data: Record<string, unknown>): T;
```

**Improvement Potential**: ⭐⭐⭐⭐ HIGH
- Could use table-specific types for better type safety
- Entity metadata could provide type information

### 3. ORM Runtime and Unit of Work (25+ instances)

**Purpose**: Entity tracking, change detection, and state management
**Files**: `src/orm/unit-of-work.ts`, `src/orm/orm-session.ts`, `src/orm/entity-context.ts`

**Key Patterns**:
- Entity tracking and state management
- Change detection and dirty tracking
- Entity identity mapping

**Examples**:
```typescript
// Entity tracking
private readonly trackedEntities = new Map<unknown, TrackedEntity>();

// Entity operations
getEntity(table: TableDef, pk: unknown): unknown | undefined;
trackNew(table: TableDef, entity: unknown, pk?: unknown): void;
```

**Improvement Potential**: ⭐⭐⭐ MEDIUM
- [x] Standardized entity tracking to use `object` instead of `unknown`
- [x] Standardized primary key usage to use `PrimaryKey` (alias for `string | number`)
- [x] Removed "split-brain" duplicate modules in `packages/` folder
- [ ] Further specific entity typing could be introduced in the future

### 4. Relation Management (40+ instances)

**Purpose**: Handles entity relationships (hasMany, belongsTo, etc.)
**Files**: `src/orm/relations/`, `src/orm/entity-relations.ts`, `src/orm/lazy-batch/`

**Key Patterns**:
- Relation data storage and retrieval
- Lazy loading and batch fetching
- Relation change tracking

**Examples**:
```typescript
// Relation storage
relationHydration: Map<string, Map<string, unknown>>;
relationWrappers: Map<string, unknown>;

// Relation operations
createEntity: (row: Record<string, unknown>) => TTarget
```

**Improvement Potential**: ⭐⭐⭐⭐ HIGH
- Relation types could be strongly typed based on target entities
- Could use generic constraints for better type safety

### 5. Query Builder and AST (30+ instances)

**Purpose**: SQL query construction and expression building
**Files**: `src/query-builder/`, `src/core/ast/`, `src/core/functions/`

**Key Patterns**:
- Expression nodes and operands
- Function return types
- Query result typing

**Examples**:
```typescript
// Expression building
export const jsonSet = <T = unknown>(target: OperandInput, path: OperandInput, value: OperandInput): TypedExpression<T>

// Query results
executeHydrated(ctx, qb): Promise<EntityInstance<TTable>[]>
```

**Improvement Potential**: ⭐⭐⭐ MEDIUM
- Some function types could be more specific
- Query builder could benefit from result type inference

### 6. Schema and Column Types (15+ instances)

**Purpose**: Database schema definition and column type mapping
**Files**: `src/schema/`, `src/core/ddl/`

**Key Patterns**:
- Column type definitions
- Default value handling
- Type conversion utilities

**Examples**:
```typescript
// Column definitions
export type ColumnToTs<T extends ColumnDef> = [unknown] extends [T['tsType']] ? ...

// Default values
export type DefaultValue = unknown | RawDefaultValue;
```

**Improvement Potential**: ⭐⭐⭐⭐ HIGH
- Column types could have better type mappings
- Default value types could be more specific

### 7. Testing and Mocking (50+ instances)

**Purpose**: Test utilities and mock implementations
**Files**: `tests/`, `playground/`

**Key Patterns**:
- Mock database clients
- Test data generation
- Query result mocking

**Examples**:
```typescript
// Mock implementations
async query(sql: string, params: unknown[]): Promise<QueryResult[]>;

// Test utilities
const flattenRowValues = (rows: Row[], order: (keyof Row)[]): unknown[]
```

**Improvement Potential**: ⭐⭐ LOW
- Testing code typically uses `unknown` for flexibility
- Less critical for production type safety

### 8. Decorators and Metadata (20+ instances)

**Purpose**: Entity decorator metadata and reflection
**Files**: `src/decorators/`

**Key Patterns**:
- Decorator context handling
- Metadata storage and retrieval
- Entity registration

**Examples**:
```typescript
// Decorator contexts
function (_value: unknown, context: ClassFieldDecoratorContext) {
  // ...
}

// Metadata storage
const metadata: Record<PropertyKey, unknown> = {};
```

**Improvement Potential**: ⭐⭐⭐ MEDIUM
- Could use more specific decorator context types
- Metadata could have structured types

### 9. Core Infrastructure (15+ instances)

**Purpose**: Core system utilities and interfaces
**Files**: `src/core/`, `src/global.d.ts`

**Key Patterns**:
- Generic utility types
- Core interfaces
- Type guards and assertions

**Examples**:
```typescript
// Utility types
type AnyFn = (...args: unknown[]) => unknown;

// Type guards
const isColumnsRecord = (columns: unknown): columns is Record<string, ColumnDef> => {
  // ...
}
```

**Improvement Potential**: ⭐⭐⭐ MEDIUM
- Some utility types could be more specific
- Core interfaces could benefit from better typing

## Top Candidates for Type Improvement

### 1. Database Execution Layer ⭐⭐⭐⭐⭐
**Priority**: CRITICAL
**Impact**: High - affects all database operations
**Examples**:
- `Record<string, unknown>` for database rows
- `unknown[]` for query parameters
- Could use table-specific types

### 2. Entity Hydration System ⭐⭐⭐⭐⭐
**Priority**: CRITICAL
**Impact**: High - affects entity creation and manipulation
**Examples**:
- Entity data representation during hydration
- Could use entity-specific types from metadata

### 3. Relation Management ⭐⭐⭐⭐
**Priority**: HIGH
**Impact**: Medium-High - affects relationship handling
**Examples**:
- Relation data storage types
- Could use target entity types for better safety

### 4. Schema and Column Types ⭐⭐⭐⭐
**Priority**: HIGH
**Impact**: Medium - affects type mapping and validation
**Examples**:
- Column type definitions
- Default value handling
- Could have better type mappings

### 5. Query Builder Results ⭐⭐⭐
**Priority**: MEDIUM
**Impact**: Medium - affects query result typing
**Examples**:
- Function return types
- Query result inference

## Recommendations

1. **Start with Database Layer**: Implement table-specific row types to improve type safety at the foundation
2. **Enhance Entity System**: Use entity metadata to provide better typing for hydration and materialization
3. **Improve Relation Types**: Leverage target entity information for relation type safety
4. **Refine Schema Types**: Better column type mappings and default value handling
5. **Gradual Migration**: Implement improvements incrementally to avoid breaking changes

## Conclusion

The Metal ORM codebase uses `unknown` extensively for flexibility, particularly in database operations, entity management, and relation handling. While this provides runtime flexibility, there are significant opportunities to improve type safety, especially in the database execution layer, entity hydration system, and relation management. These improvements would enhance developer experience, reduce runtime errors, and provide better IDE support.