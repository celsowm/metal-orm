# SQL Array & JSON Functions – Deep Comparison

**Status Legend:** ✅ Implemented | 🟡 Partial/Via Escape Hatches | ⚙️ Planned | ❌ Not Available

## Arrays (native ARRAY vs JSON equivalents)

| Operation | ANSI / ISO SQL | PostgreSQL | MySQL | SQL Server | SQLite | Metal-ORM Status |
|---|---|---|---|---|---|---|
| Native ARRAY type | Yes (standard) | Yes (`int[]`) | No | No | No | 🟡 `col.custom('int[]')` |
| Construct | `ARRAY[1,2,3]` | `ARRAY[1,2,3]` | `JSON_ARRAY(1,2,3)` | `JSON_ARRAY(1,2,3)` | `json_array(1,2,3)` | 🟡 `col.defaultRaw('ARRAY[1,2,3]')` |
| Element access | Impl‑dependent | `arr[1]` (1‑based) | `j->'$[0]'` | `JSON_VALUE(j,'$[0]')` | `j->'$[0]'` | ✅ `jsonPath(c,'$[0]')` |
| Slice | Impl‑dependent | `arr[1:3]` | via `JSON_TABLE` | via `OPENJSON` | via `json_each` | 🟡 `col.defaultRaw('arr[1:3]')` |
| Unnest | `UNNEST()` | `unnest()` | `JSON_TABLE` | `OPENJSON` | `json_each` | 🟡 `fnTable('json_each', ...)` |
| Aggregate | `ARRAY_AGG()` | `array_agg()` | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | ⚙️ `fn('JSON_ARRAYAGG', ...)` |
| Contains | Impl‑dependent | `arr @> ARRAY[3]` | `JSON_CONTAINS()` | `OPENJSON` + WHERE | `json_each` + WHERE | ⚙️ `fn('JSON_CONTAINS', ...)` |
| Append | Impl‑dependent | `arr || ARRAY[x]` | `JSON_ARRAY_APPEND()` | `JSON_MODIFY()` | re‑aggregate | ⚙️ `fn('ARRAY_APPEND', ...)` |
| Update element | Impl‑dependent | `arr[2]=99` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | ⚙️ `fn('JSON_SET', ...)` |

---

## JSON Functions

| Operation | ANSI / ISO SQL (SQL/JSON) | PostgreSQL | MySQL | SQL Server | SQLite | Metal-ORM Status |
|---|---|---|---|---|---|---|
| JSON type | Standard defined | `json/jsonb` | `JSON` | `json` / nvarchar | TEXT / JSONB | ✅ `col.json()` |
| Validate | `JSON_EXISTS` | enforced | enforced | `ISJSON()` | `json_valid()` | ⚙️ `fn('json_valid', ...)` |
| Scalar extract | `JSON_VALUE` | `->>` | `JSON_VALUE()` | `JSON_VALUE()` | `->>` | ✅ `jsonPath(c,'$.path')` |
| Object extract | `JSON_QUERY` | `->` | `JSON_EXTRACT()` | `JSON_QUERY()` | `->` | ✅ `jsonPath(c,'$.obj')` |
| Shred to rows | `JSON_TABLE` | `JSON_TABLE` | `JSON_TABLE` | `OPENJSON` | `json_each` | 🟡 `fnTable('json_each', ...)` |
| Build JSON | `JSON_OBJECT/ARRAY` | SQL/JSON | `JSON_OBJECT()` | `JSON_OBJECT()` | `json_object()` | ⚙️ `fn('JSON_OBJECT', ...)` |
| Aggregate JSON | `JSON_ARRAYAGG` | patterns | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | ⚙️ `fn('JSON_ARRAYAGG', ...)` |
| Modify JSON | `JSON_TRANSFORM` | `jsonb_set()` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | ⚙️ `fn('JSON_SET', ...)` |
| Array length | Impl‑dependent | `jsonb_array_length()` | `JSON_LENGTH()` | count `OPENJSON` | `json_array_length()` | ⚙️ `fn('JSON_LENGTH', ...)` |
| Indexing | Impl‑dependent | GIN (`jsonb`) | generated cols | computed cols | expression index | ❌ Database-specific |

---

## Current Implementation Status

### ✅ What's Already Working

Metal-ORM **currently supports** the following JSON/array features:

1. **JSON Path Expressions** - Full cross-dialect support via `jsonPath()`
   - PostgreSQL: Compiles to `->>` for scalar, `->` for objects
   - MySQL: Compiles to `->'$.path'`
   - SQLite: Compiles to `json_extract(col, '$.path')`
   - SQL Server: Compiles to `JSON_VALUE(col, '$.path')`

2. **JSON Column Type** - Schema definition via `col.json()`
   - Maps to `JSONB` in PostgreSQL
   - Maps to `JSON` in MySQL
   - Maps to `TEXT` in SQLite (with JSON functions)
   - Maps to `NVARCHAR(MAX)` in SQL Server

3. **Custom Array Types** - PostgreSQL native arrays via `col.custom()`
   - Example: `col.custom('int[]')`, `col.custom('text[]')`

4. **Escape Hatches** - Raw SQL for advanced cases
   - `col.defaultRaw()` for complex default values
   - `selectRaw()` for custom expressions
   - `fn()` for any database function

### ⚙️ What's Planned (via Function Strategies)

These features will be added as dialect-aware function strategies:

- `JSON_LENGTH()` - Get JSON array/object size
- `JSON_SET()` / `JSON_MODIFY()` - Update JSON values
- `JSON_ARRAYAGG()` - Aggregate rows into JSON array
- `JSON_CONTAINS()` - Check if JSON contains value
- `ARRAY_APPEND()` - Append to array (native or JSON)

---

## Metal-ORM Implementation Details

### JSON Path Support
Metal-ORM provides first-class JSON path support through the `jsonPath()` function:

```typescript
import { jsonPath, eq } from 'metal-orm/ast';

// PostgreSQL: users.settings->>'$.theme'
// MySQL: users.settings->'$.theme'  
// SQL Server: JSON_VALUE(users.settings, '$.theme')
// SQLite: json_extract(users.settings, '$.theme')
const query = users.select('*')
  .where(eq(jsonPath(users.columns.settings, '$.theme'), 'dark'));
```

### JSON Column Definition (✅ Implemented)

Define JSON columns in your schema **today** using `col.json()`:

```typescript
import { col } from 'metal-orm/schema';

const User = defineTable({
  id: col.int().primaryKey(),
  settings: col.json(), // ✅ Maps to JSONB in PostgreSQL, JSON in others
  metadata: col.json()
});
```

**Dialect mappings:**
- PostgreSQL: `JSONB` (binary JSON, more efficient)
- MySQL: `JSON` (native JSON type)
- SQLite: `TEXT` (with JSON validation functions)
- SQL Server: `NVARCHAR(MAX)` (stores JSON as text)


### Function Tables for Array Operations (🟡 Partial Support)

For array-like operations, Metal-ORM supports function tables through `fnTable()`. This feature exists but needs better documentation:

```typescript
// ✅ This pattern works but requires manual setup
import { fnTable, lit } from 'metal-orm/ast';

// SQLite: json_each(user.tags)
const query = users
  .select(['name', 'je.value as tag'])
  .join(fnTable('json_each', [users.columns.tags], 'je'))
  .where(eq(lit('je.key'), 0));
```

**Note:** `fnTable()` support varies by dialect and may require additional configuration.

### Custom Types for Native Arrays (✅ PostgreSQL Only)

Use `col.custom()` to define **PostgreSQL native array types**:

```typescript
// ✅ Works in PostgreSQL
const Post = defineTable({
  id: col.int().primaryKey(),
  tags: col.custom('text[]'),      // PostgreSQL TEXT[]
  scores: col.custom('integer[]')  // PostgreSQL INTEGER[]
});
```

**Important:** Native arrays are PostgreSQL-specific. For cross-database compatibility, use JSON arrays instead.


---

## Key Gotchas

- PostgreSQL ARRAY indexing is **1‑based**, JSON paths are **0‑based**.
- MySQL, SQL Server, SQLite emulate arrays using JSON.
- SQLite has no JSON type but built‑in JSON functions and JSONB storage.
- For joins & filters, always shred JSON arrays into rows using function tables.
- Metal-ORM's `jsonPath()` automatically translates to dialect-specific syntax.
- Use `col.custom()` for dialect-specific types like PostgreSQL arrays.

---

## Implementation Strategies (Easiest to Hardest)

### 1. ✅ Escape Hatches (Already Implemented)

Use when you need a specific SQL feature immediately without modifying the ORM core. **These work today:**

- **Schema:** Use `col.custom('MY_TYPE')` to define native arrays or specialized types.
- **Values:** Use `col.defaultRaw('ARRAY[1, 2, 3]')` for complex defaults.
- **Queries:** Use `selectRaw()` or `fn()` for raw SQL expressions.

```typescript
// ✅ PostgreSQL array literal default - works today!
const User = defineTable({
  id: col.int().primaryKey(),
  roles: col.custom('text[]').defaultRaw("ARRAY['admin', 'user']")
});

// ✅ Raw function calls - works today!
const result = users.selectRaw('array_length(roles, 1) as role_count');
```

### 2. ✅ JSON Path Access (Already Implemented)

Use for dialect-agnostic access to nested JSON data. **Fully implemented and working:**

- **Access:** Use `jsonPath(column, '$.path')`. Metal-ORM automatically translates this to the correct syntax for Postgres (`->>`), MySQL (`->`), SQLite (`json_extract`), and SQL Server (`JSON_VALUE`).

```typescript
import { jsonPath, eq, fn, gt, and } from 'metal-orm/ast';

// ✅ Dialect-agnostic JSON path access - works today!
const activeUsers = users.select('*')
  .where(and(
    eq(jsonPath(users.columns.settings, '$.active'), true),
    gt(jsonPath(users.columns.settings, '$.loginCount'), 5)
  ));
```

### 3. ⚙️ Generic Function Helpers (Planned)

Use `fn()` for common functions that work across dialects using the function strategy system. **These are planned:**

```typescript
import { fn } from 'metal-orm/ast';

// ⚙️ Planned - cross-dialect function calls
const userStats = users.select([
  'id',
  fn('JSON_LENGTH', users.columns.tags).as('tag_count'),
  fn('JSON_EXTRACT', users.columns.metadata, '$.level').as('user_level')
]);
```

**Status:** Function strategies need to be added for:
- `JSON_LENGTH` - Get array/object size
- `JSON_SET` / `JSON_MODIFY` - Update JSON values
- `JSON_ARRAYAGG` - Aggregate to JSON array
- `JSON_CONTAINS` - Check containment

### 4. ⚙️ Native AST Nodes (Future / Best)

Use for first-class, type-safe support of new SQL constructs. **This is the most robust approach but requires core changes:**

- **Define:** Add a new node type in `src/core/ast/expression-nodes.ts`.
- **Build:** Create a helper in `src/core/ast/expression-builders.ts` (e.g., `arrayAppend(...)`).
- **Compile:** Update `src/core/dialect/abstract.ts` and individual dialect implementations (e.g., `postgres/index.ts`) to handle the new node.
- **Verification:** Add tests in `tests/query-operations/` to ensure correct rendering across all supported databases.

```typescript
// ⚙️ Future - example of native AST node for arrayAppend
// 1. Define node in expression-nodes.ts
export interface ArrayAppendNode {
  type: 'ArrayAppend';
  array: OperandNode;
  element: OperandNode;
}

// 2. Create builder in expression-builders.ts
export const arrayAppend = (array: OperandNode, element: OperandNode): ArrayAppendNode => ({
  type: 'ArrayAppend',
  array,
  element
});

// 3. Add compiler in postgres/index.ts
this.registerOperandCompiler('ArrayAppend', (node: ArrayAppendNode, ctx) => {
  const arr = this.compileOperand(node.array, ctx);
  const elem = this.compileOperand(node.element, ctx);
  return `${arr} || ARRAY[${elem}]`;
});
```

### 5. ⚙️ Function Strategies (Recommended Next Step)

Leverage the function strategy system for dialect-specific implementations. **This is the current recommendation for adding new JSON/array functions:**

```typescript
// ⚙️ Planned - in postgres/functions.ts
this.add('ARRAY_APPEND', ({ compiledArgs }) => {
  if (compiledArgs.length !== 2) throw new Error('ARRAY_APPEND expects 2 arguments');
  const [array, element] = compiledArgs;
  return `${array} || ARRAY[${element}]`;
});

// ⚙️ Planned - in mysql/functions.ts  
this.add('ARRAY_APPEND', ({ compiledArgs }) => {
  if (compiledArgs.length !== 2) throw new Error('ARRAY_APPEND expects 2 arguments');
  const [array, element] = compiledArgs;
  return `JSON_ARRAY_APPEND(${array}, '$', ${element})`;
});
```


---

## Testing JSON/Array Operations

### ✅ Testing Existing Features

Metal-ORM includes test coverage for JSON operations. You can verify the existing `jsonPath()` implementation:

```typescript
// ✅ Current test in tests/database/postgres.test.ts
it('should compile a select with a json path', () => {
  const query = new SelectQueryBuilder(Users)
    .selectRaw('*')
    .where(eq(jsonPath(Users.columns.settings, '$.first'), 'John'));
  const dialect = new PostgresDialect();
  const compiled = query.compile(dialect);
  expect(compiled.sql).toBe('SELECT "users"."*" FROM "users" WHERE "users"."settings"->>'$.first' = ?;');
  expect(compiled.params).toEqual(['John']);
});
```

**Run existing tests:**
```bash
# Test jsonPath compilation for PostgreSQL
npm test tests/database/postgres.test.ts

# Test all dialect-specific implementations
npm test tests/query-operations/
```

### ⚙️ Testing Planned Features

When function strategies are added, tests should follow the pattern from existing function tests:

```typescript
// ⚙️ Future test pattern for JSON functions
describe('JSON Functions', () => {
  it('should compile JSON_LENGTH for PostgreSQL', () => {
    const query = Users.select([
      'id',
      fn('JSON_LENGTH', Users.columns.tags).as('tag_count')
    ]);
    const dialect = new PostgresDialect();
    const compiled = query.compile(dialect);
    expect(compiled.sql).toContain('jsonb_array_length');
  });
  
  it('should compile JSON_LENGTH for MySQL', () => {
    const query = Users.select([
      'id',
      fn('JSON_LENGTH', Users.columns.tags).as('tag_count')
    ]);
    const dialect = new MySqlDialect();
    const compiled = query.compile(dialect);
    expect(compiled.sql).toContain('JSON_LENGTH');
  });
});
```

---

## Summary: What You Can Use Today

### ✅ Fully Implemented
- **`jsonPath(col, '$.path')`** - Cross-dialect JSON path access
- **`col.json()`** - JSON column type in schema
- **`col.custom('type[]')`** - PostgreSQL native arrays
- **`col.defaultRaw('...')`** - Raw SQL defaults
- **`selectRaw('...')`** - Raw SQL expressions

### 🟡 Partially Supported (Via Escape Hatches)
- **`fnTable('json_each', ...)`** - Function tables (needs docs)
- **Array operations** - Use `col.defaultRaw()` or raw SQL

### ⚙️ Planned (Function Strategies)
- **`fn('JSON_LENGTH', ...)`** - Get JSON array/object size
- **`fn('JSON_SET', ...)`** - Update JSON values
- **`fn('JSON_ARRAYAGG', ...)`** - Aggregate to JSON array
- **`fn('JSON_CONTAINS', ...)`** - Check containment
- **`fn('ARRAY_APPEND', ...)`** - Append to arrays

---

## Next Steps for Contributors

1. **Add function strategies** for JSON/array operations (see `implementation_plan.md`)
2. **Add comprehensive tests** following the pattern in `tests/query-operations/functions/`
3. **Document `fnTable()`** usage patterns and limitations
4. **Add examples** to README and documentation

This comprehensive guide shows Metal-ORM's current JSON and array support across all databases (PostgreSQL, MySQL, SQLite, SQL Server), with clear indicators of what's implemented (✅), partially supported (🟡), planned (⚙️), or not available (❌). The ORM maintains type safety while providing both simple escape hatches and advanced function strategies for cross-database compatibility.

