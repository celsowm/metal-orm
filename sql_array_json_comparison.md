# SQL Array & JSON Functions – Deep Comparison

## Arrays (native ARRAY vs JSON equivalents)

| Operation | ANSI / ISO SQL | PostgreSQL | MySQL | SQL Server | SQLite | MO (Metal-ORM) |
|---|---|---|---|---|---|---|
| Native ARRAY type | Yes (standard) | Yes (`int[]`) | No | No | No | `col.custom('int[]')` |
| Construct | `ARRAY[1,2,3]` | `ARRAY[1,2,3]` | `JSON_ARRAY(1,2,3)` | `JSON_ARRAY(1,2,3)` | `json_array(1,2,3)` | `col.defaultRaw('ARRAY[1,2,3]')` |
| Element access | Impl‑dependent | `arr[1]` (1‑based) | `j->'$[0]'` | `JSON_VALUE(j,'$[0]')` | `j->'$[0]'` | `jsonPath(c,'$[0]')` |
| Slice | Impl‑dependent | `arr[1:3]` | via `JSON_TABLE` | via `OPENJSON` | via `json_each` | `col.defaultRaw('arr[1:3]')` |
| Unnest | `UNNEST()` | `unnest()` | `JSON_TABLE` | `OPENJSON` | `json_each` | `fnTable('json_each', ...)` |
| Aggregate | `ARRAY_AGG()` | `array_agg()` | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | `fn('JSON_ARRAYAGG', ...)` |
| Contains | Impl‑dependent | `arr @> ARRAY[3]` | `JSON_CONTAINS()` | `OPENJSON` + WHERE | `json_each` + WHERE | `fn('JSON_CONTAINS', ...)` |
| Append | Impl‑dependent | `arr || ARRAY[x]` | `JSON_ARRAY_APPEND()` | `JSON_MODIFY()` | re‑aggregate | `fn('JSON_ARRAY_APPEND', ...)` |
| Update element | Impl‑dependent | `arr[2]=99` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | `fn('JSON_SET', ...)` |

---

## JSON Functions

| Operation | ANSI / ISO SQL (SQL/JSON) | PostgreSQL | MySQL | SQL Server | SQLite | MO (Metal-ORM) |
|---|---|---|---|---|---|---|
| JSON type | Standard defined | `json/jsonb` | `JSON` | `json` / nvarchar | TEXT / JSONB | `col.json()` |
| Validate | `JSON_EXISTS` | enforced | enforced | `ISJSON()` | `json_valid()` | `fn('json_valid', ...)` |
| Scalar extract | `JSON_VALUE` | `->>` | `JSON_VALUE()` | `JSON_VALUE()` | `->>` | `jsonPath(c,'$')` |
| Object extract | `JSON_QUERY` | `->` | `JSON_EXTRACT()` | `JSON_QUERY()` | `->` | `jsonPath(c,'$')` |
| Shred to rows | `JSON_TABLE` | `JSON_TABLE` | `JSON_TABLE` | `OPENJSON` | `json_each` | `fnTable('json_each', ...)` |
| Build JSON | `JSON_OBJECT/ARRAY` | SQL/JSON | `JSON_OBJECT()` | `JSON_OBJECT()` | `json_object()` | `fn('JSON_OBJECT', ...)` |
| Aggregate JSON | `JSON_ARRAYAGG` | patterns | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | `fn('JSON_ARRAYAGG', ...)` |
| Modify JSON | `JSON_TRANSFORM` | `jsonb_set()` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | `fn('JSON_SET', ...)` |
| Array length | Impl‑dependent | `jsonb_array_length()` | `JSON_LENGTH()` | count `OPENJSON` | `json_array_length()` | `fn('JSON_LENGTH', ...)` |
| Indexing | Impl‑dependent | GIN (`jsonb`) | generated cols | computed cols | expression index | Database-specific |

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

### JSON Column Definition
```typescript
import { col } from 'metal-orm/schema';

const User = defineTable({
  id: col.int().primaryKey(),
  settings: col.json(), // Maps to JSONB in PostgreSQL, JSON in others
  metadata: col.json()
});
```

### Function Tables for Array Operations
For array-like operations, Metal-ORM supports function tables:

```typescript
// SQLite: json_each(user.tags)
import { fnTable, lit } from 'metal-orm/ast';

const query = users
  .select(['name', 'je.value as tag'])
  .join(fnTable('json_each', [users.columns.tags], 'je'))
  .where(eq(lit('je.key'), 0));
```

### Custom Types for Native Arrays
```typescript
// PostgreSQL native arrays
const Post = defineTable({
  id: col.int().primaryKey(),
  tags: col.custom('text[]'), // PostgreSQL TEXT[]
  scores: col.custom('integer[]') // PostgreSQL INTEGER[]
});
```

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

### 1. Escape Hatches (Easiest)
Use when you need a specific SQL feature immediately without modifying the ORM core.
- **Schema:** Use `col.custom('MY_TYPE')` to define native arrays or specialized types.
- **Values:** Use `col.defaultRaw('ARRAY[1, 2, 3]')` for complex defaults.
- **Queries:** Use `selectRaw()` or `fn()` for raw SQL expressions.

```typescript
// PostgreSQL array literal default
const User = defineTable({
  id: col.int().primaryKey(),
  roles: col.custom('text[]').defaultRaw("ARRAY['admin', 'user']")
});

// Raw function calls
const result = users.selectRaw('array_length(roles, 1) as role_count');
```

### 2. Generic Helpers (Standard)
Use for dialect-agnostic access to nested data.
- **Access:** Use `jsonPath(column, '$.path')`. Metal-ORM automatically translates this to the correct syntax for Postgres (`->>`), MySQL (`->`), SQLite (`json_extract`), and SQL Server (`JSON_VALUE`).
- **Standard Functions:** Use `fn()` for common functions that work across dialects using the function strategy system.

```typescript
import { jsonPath, eq, fn, gt, lt, and } from 'metal-orm/ast';

// Dialect-agnostic JSON path access
const activeUsers = users.select('*')
  .where(and(
    eq(jsonPath(users.columns.settings, '$.active'), true),
    gt(jsonPath(users.columns.settings, '$.loginCount'), 5)
  ));

// Cross-dialect function calls
const userStats = users.select([
  'id',
  fn('JSON_LENGTH', users.columns.tags).as('tag_count'),
  fn('JSON_EXTRACT', users.columns.metadata, '$.level').as('user_level')
]);
```

### 3. Native AST Nodes (Hardest / Best)
Use for first-class, type-safe support of new SQL constructs.
- **Define:** Add a new node type in `src/core/ast/expression-nodes.ts`.
- **Build:** Create a helper in `src/core/ast/expression-builders.ts` (e.g., `arrayAppend(...)`).
- **Compile:** Update `src/core/dialect/abstract.ts` and individual dialect implementations (e.g., `postgres/index.ts`) to handle the new node.
- **Verification:** Add tests in `tests/query-operations/` to ensure correct rendering across all supported databases.

```typescript
// Example: Adding arrayAppend support
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

### 4. Function Strategies (Advanced)
Leverage the function strategy system for dialect-specific implementations:

```typescript
// In postgres/functions.ts
this.add('ARRAY_APPEND', ({ compiledArgs }) => {
  if (compiledArgs.length !== 2) throw new Error('ARRAY_APPEND expects 2 arguments');
  const [array, element] = compiledArgs;
  return `${array} || ARRAY[${element}]`;
});

// In mysql/functions.ts  
this.add('ARRAY_APPEND', ({ compiledArgs }) => {
  if (compiledArgs.length !== 2) throw new Error('ARRAY_APPEND expects 2 arguments');
  const [array, element] = compiledArgs;
  return `JSON_ARRAY_APPEND(${array}, '$', ${element})`;
});
```

---

## Testing JSON/Array Operations

Metal-ORM includes comprehensive test coverage for JSON operations:

```typescript
// Test from tests/database/postgres.test.ts
it('should compile a select with a json path', () => {
  const query = new SelectQueryBuilder(Users)
    .selectRaw('*')
    .where(eq(jsonPath(Users.columns.settings, '$.first'), 'John'));
  const dialect = new PostgresDialect();
  const compiled = query.compile(dialect);
  expect(compiled.sql).toBe('SELECT "users"."*" FROM "users" WHERE "users"."settings"->>\'$.first\' = ?;');
  expect(compiled.params).toEqual(['John']);
});
```

This comprehensive approach allows Metal-ORM to handle JSON and array operations across all supported databases while maintaining type safety and providing both simple and advanced implementation strategies.
