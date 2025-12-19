# SQL Array & JSON Functions – Deep Comparison

## Arrays (native ARRAY vs JSON equivalents)

| Operation | ANSI / ISO SQL | PostgreSQL | MySQL | SQL Server | SQLite | MO (Metal-ORM) |
|---|---|---|---|---|---|---|
| Native ARRAY type | Yes (standard) | Yes (`int[]`) | No | No | No | `col.custom('T[]')` |
| Construct | `ARRAY[1,2,3]` | `ARRAY[1,2,3]` | `JSON_ARRAY(1,2,3)` | `JSON_ARRAY(1,2,3)` | `json_array(1,2,3)` | `defaultRaw` / Lit |
| Element access | Impl‑dependent | `arr[1]` (1‑based) | `j->'$[0]'` | `JSON_VALUE(j,'$[0]')` | `j->'$[0]'` | `jsonPath(c,'$[0]')` |
| Slice | Impl‑dependent | `arr[1:3]` | via `JSON_TABLE` | via `OPENJSON` | via `json_each` | - |
| Unnest | `UNNEST()` | `unnest()` | `JSON_TABLE` | `OPENJSON` | `json_each` | - |
| Aggregate | `ARRAY_AGG()` | `array_agg()` | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | - |
| Contains | Impl‑dependent | `arr @> ARRAY[3]` | `JSON_CONTAINS()` | `OPENJSON` + WHERE | `json_each` + WHERE | - |
| Append | Impl‑dependent | `arr || ARRAY[x]` | `JSON_ARRAY_APPEND()` | `JSON_MODIFY()` | re‑aggregate | - |
| Update element | Impl‑dependent | `arr[2]=99` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | - |

---

## JSON Functions

| Operation | ANSI / ISO SQL (SQL/JSON) | PostgreSQL | MySQL | SQL Server | SQLite | MO (Metal-ORM) |
|---|---|---|---|---|---|---|
| JSON type | Standard defined | `json/jsonb` | `JSON` | `json` / nvarchar | TEXT / JSONB | `col.json()` |
| Validate | `JSON_EXISTS` | enforced | enforced | `ISJSON()` | `json_valid()` | - |
| Scalar extract | `JSON_VALUE` | `->>` | `JSON_VALUE()` | `JSON_VALUE()` | `->>` | `jsonPath(c,'$')` |
| Object extract | `JSON_QUERY` | `->` | `JSON_EXTRACT()` | `JSON_QUERY()` | `->` | `jsonPath(c,'$')` |
| Shred to rows | `JSON_TABLE` | `JSON_TABLE` | `JSON_TABLE` | `OPENJSON` | `json_each` | - |
| Build JSON | `JSON_OBJECT/ARRAY` | SQL/JSON | `JSON_OBJECT()` | `JSON_OBJECT()` | `json_object()` | - |
| Aggregate JSON | `JSON_ARRAYAGG` | patterns | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` | - |
| Modify JSON | `JSON_TRANSFORM` | `jsonb_set()` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` | - |
| Array length | Impl‑dependent | `jsonb_array_length()` | `JSON_LENGTH()` | count `OPENJSON` | `json_array_length()` | - |
| Indexing | Impl‑dependent | GIN (`jsonb`) | generated cols | computed cols | expression index | - |

---

## Key Gotchas

- PostgreSQL ARRAY indexing is **1‑based**, JSON paths are **0‑based**.
- MySQL, SQL Server, SQLite emulate arrays using JSON.
- SQLite has no JSON type but built‑in JSON functions and JSONB storage.
- For joins & filters, always shred JSON arrays into rows.

---

## Implementation Strategies (Easiest to Hardest)

### 1. Escape Hatches (Easiest)
Use when you need a specific SQL feature immediately without modifying the ORM core.
- **Schema:** Use `col.custom('MY_TYPE')` to define native arrays or specialized types.
- **Values:** Use `defaultRaw('ARRAY[1, 2, 3]')` for complex defaults.
- **Queries:** Use `sql` template tags (if available) or raw expressions to inject native SQL.

### 2. Generic Helpers (Standard)
Use for dialect-agnostic access to nested data.
- **Access:** Use `jsonPath(column, '$.path')`. Metal-ORM automatically translates this to the correct syntax for Postgres (`->>`), MySQL (`->`), SQLite (`json_extract`), and SQL Server (`JSON_VALUE`).
- **Standard Functions:** Map common functions (like `LOWER`, `COUNT`) that work across dialects using the `FunctionStrategy`.

### 3. Native AST Nodes (Hardest / Best)
Use for first-class, type-safe support of new SQL constructs.
- **Define:** Add a new node type in `src/core/ast/expression-nodes.ts`.
- **Build:** Create a helper in `src/core/ast/expression-builders.ts` (e.g., `arrayAppend(...)`).
- **Compile:** Update `src/core/dialect/abstract.ts` and individual dialect implementations (e.g., `postgres/index.ts`) to handle the new node.
- **Verification:** Add tests in `tests/query-operations/` to ensure correct rendering across all supported databases.

