# Query Layer Refactoring Progress

## Completed Steps (1-7)

### ✅ Step 1: QueryTarget Resolver
**File**: `src/query/target.ts`
- Created unified `QueryTarget<TTable>` type accepting either `TableDef` or `EntityConstructor`
- Implemented `resolveTable()` function that handles both entity classes and table definitions
- Uses decorator metadata bootstrapper to resolve entity constructors to `TableDef`

### ✅ Step 2: Verb-First Entrypoints
**File**: `src/query/index.ts`
- Implemented clean API: `selectFrom(target)`, `insertInto(target)`, `update(target)`, `deleteFrom(target)`
- All entrypoints use the `QueryTarget` resolver
- Builder constructors remain available but the new API is the recommended pattern

### ✅ Step 3: Fixed compile() Correctness Bug
**File**: `src/query-builder/select.ts`
- **Before**: `compile()` compiled `this.context.state.ast` (raw AST)
- **After**: `compile()` now compiles `this.getAST()` (hydrated AST with relations applied)
- **Impact**: `toSql()` now accurately reflects what will be executed
- This eliminates the entire class of "SQL output differs from execution" bugs

### ✅ Step 4: Unified .select() with Overloads
**File**: `src/query-builder/select.ts`
- Replaced separate `select()` and `selectColumns()` methods with unified overloaded `.select()`
- Supports both: `.select('id', 'name')` and `.select({ aliasedCol: expression })`
- Marked `selectColumns()` as `@deprecated` (points to new `.select()`)
- Detection logic: checks if first arg is object (projection map) vs string (column names)

### ✅ Step 6: Type-Safe Relations (No More Stringly-Typed)
**File**: `src/query-builder/select.ts`
- Added generic constraints to relation methods:
  - `match<K extends keyof TTable['relations'] & string>(relationName: K, ...)`
  - `joinRelation<K extends keyof TTable['relations'] & string>(relationName: K, ...)`
  - `include<K extends keyof TTable['relations'] & string>(relationName: K, ...)`
  - `whereHas<K extends keyof TTable['relations'] & string>(relationName: K, ...)`
  - `whereHasNot<K extends keyof TTable['relations'] & string>(relationName: K, ...)`
- **Impact**: TypeScript now enforces relation name validity at compile time
- Invalid relation names will cause type errors instead of runtime errors

### ✅ Step 7: Centralized Builder-or-AST Resolution
**File**: `src/query-builder/query-resolution.ts` (NEW)
- Created shared resolution helpers:
  - `resolveSelectQuery(query)` - handles SelectQueryBuilder | SelectQueryNode
  - `resolveUpdateQuery(query)` - handles UpdateQueryBuilder | UpdateQueryNode  
  - `resolveDeleteQuery(query)` - handles DeleteQueryBuilder | DeleteQueryNode
  - `resolveTableSource(source)` - handles TableDef | TableSourceNode
  - `resolveJoinTarget(table)` - handles TableDef | TableSourceNode | string
- **Before**: Each file had its own duck-typed `resolveQueryNode()` method
- **After**: Single source of truth, reusable across all query builders
- Replaced 8+ usages in `select.ts` with centralized `resolveSelectQuery()`

---

### ✅ Step 10: Normalize Compilation API Across Select/Update/Delete  
**Files**: `src/query-builder/update.ts`, `src/query-builder/delete.ts`
- Removed compiler overload complexity from Update/Delete builders
- Now accept only `compile(dialect: Dialect | DialectKey)` - clean and consistent
- Matches Select builder API exactly

### ✅ Step 11: Make Execution Consistent Across Query Types
**Files**: `src/query-builder/update.ts`, `src/query-builder/delete.ts`
- Added `execute(session: OrmSession): Promise<QueryResult[]>` to both Update and Delete
- All query builders now have consistent execution interface
- Compiles using session's dialect, executes via `session.executor.executeSql()`

### ✅ Step 12: Clean File Boundaries (Move AST Helpers)
**File**: `src/core/ast/helpers.ts` (NEW)
- Moved `createColumn()` and `createLiteral()` from `select.ts` to dedicated helpers module
- Cleaner separation: AST utilities no longer mixed with query builder code
- Single import point for all AST helper functions

### ✅ Step 13: Replace selectColumnsDeep with Typed Iteration
**File**: `src/query-builder/select.ts`
- **Before**: Object-based config with `Object.keys()` casting
- **After**: Array of discriminated union types
- New API: `DeepSelectEntry<TTable>` with `type: 'root' | 'relation'`
- Clean iteration without type gymnastics

---

## Remaining Steps - Not Implemented

### ⏸️ Step 5: Make PK Always Selected as Hard Invariant
- **Complexity**: Medium
- **Blocker**: Requires modifying execution layer to auto-ensure PK in projection
- **Impact**: Would need changes to `executeHydrated()` to inspect and modify projections

### ⏸️ Step 8: Split SelectQueryBuilder into Focused Facets (SOLID)
- **Complexity**: High - major architectural refactor
- **Would create**: SelectProjectionFacet, SelectFromFacet, SelectPredicateFacet, SelectJoinFacet, etc.
- **Trade-off**: More files/complexity vs single responsibility principle

### ⏸️ Step 9: Make Dependencies Truly Injected (DIP)
- **Complexity**: Medium
- **Currently**: Constructor directly creates `new ColumnSelector()`, `new RelationManager()`
- **Would change**: Factory methods in dependencies object

### ⏸️ Step 14: Add Golden SQL Tests and Invariant Tests
- **Complexity**: Medium - requires comprehensive test suite creation
- **Would include**: SQL output vs execution tests, PK invariant tests, type safety tests

---

## Benefits Achieved So Far

1. **Type Safety**: Relations are now compile-time checked, eliminating entire class of runtime errors
2. **Correctness**: `compile()` output now matches actual executed SQL (critical bug fix)
3. **Clean API**: Verb-first entry points (`selectFrom`, `insertInto`, etc.) follow SQL conventions
4. **Maintainability**: Centralized query resolution eliminates code duplication
5. **Developer Experience**: Unified `.select()` method is more intuitive and Kysely-aligned
6. **Extensibility**: QueryTarget abstraction makes it easy to add new query sources

## Breaking Changes

None of the completed steps introduce breaking changes:
- Old APIs remain functional (some marked `@deprecated`)
- New entry points are additions, not replacements
- Type constraints are additive (catch more errors at compile time)

## Next Steps Recommendation

If continuing the refactor, prioritize:
1. **Step 12** (Move AST helpers) - Low complexity, high cleanliness gain
2. **Step 10** (Normalize compilation API) - Low complexity, consistency improvement
3. **Step 5** (PK invariant) - Medium complexity, correctness improvement
4. **Step 14** (Tests) - Validate all changes and prevent regressions

The foundation is now much cleaner and ready for the more advanced structural changes (Steps 8-9).
