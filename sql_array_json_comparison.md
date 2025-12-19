# SQL Array & JSON Functions – Deep Comparison

## Arrays (native ARRAY vs JSON equivalents)

| Operation | ANSI / ISO SQL | PostgreSQL | MySQL | SQL Server | SQLite |
|---|---|---|---|---|---|
| Native ARRAY type | Yes (standard) | Yes (`int[]`) | No | No | No |
| Construct | `ARRAY[1,2,3]` | `ARRAY[1,2,3]` | `JSON_ARRAY(1,2,3)` | `JSON_ARRAY(1,2,3)` | `json_array(1,2,3)` |
| Element access | Impl‑dependent | `arr[1]` (1‑based) | `j->'$[0]'` | `JSON_VALUE(j,'$[0]')` | `j->'$[0]'` |
| Slice | Impl‑dependent | `arr[1:3]` | via `JSON_TABLE` | via `OPENJSON` | via `json_each` |
| Unnest | `UNNEST()` | `unnest()` | `JSON_TABLE` | `OPENJSON` | `json_each` |
| Aggregate | `ARRAY_AGG()` | `array_agg()` | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` |
| Contains | Impl‑dependent | `arr @> ARRAY[3]` | `JSON_CONTAINS()` | `OPENJSON` + WHERE | `json_each` + WHERE |
| Append | Impl‑dependent | `arr || ARRAY[x]` | `JSON_ARRAY_APPEND()` | `JSON_MODIFY()` | re‑aggregate |
| Update element | Impl‑dependent | `arr[2]=99` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` |

---

## JSON Functions

| Operation | ANSI / ISO SQL (SQL/JSON) | PostgreSQL | MySQL | SQL Server | SQLite |
|---|---|---|---|---|---|
| JSON type | Standard defined | `json/jsonb` | `JSON` | `json` / nvarchar | TEXT / JSONB |
| Validate | `JSON_EXISTS` | enforced | enforced | `ISJSON()` | `json_valid()` |
| Scalar extract | `JSON_VALUE` | `->>` | `JSON_VALUE()` | `JSON_VALUE()` | `->>` |
| Object extract | `JSON_QUERY` | `->` | `JSON_EXTRACT()` | `JSON_QUERY()` | `->` |
| Shred to rows | `JSON_TABLE` | `JSON_TABLE` | `JSON_TABLE` | `OPENJSON` | `json_each` |
| Build JSON | `JSON_OBJECT/ARRAY` | SQL/JSON | `JSON_OBJECT()` | `JSON_OBJECT()` | `json_object()` |
| Aggregate JSON | `JSON_ARRAYAGG` | patterns | `JSON_ARRAYAGG()` | `JSON_ARRAYAGG()` | `json_group_array()` |
| Modify JSON | `JSON_TRANSFORM` | `jsonb_set()` | `JSON_SET()` | `JSON_MODIFY()` | `json_set()` |
| Array length | Impl‑dependent | `jsonb_array_length()` | `JSON_LENGTH()` | count `OPENJSON` | `json_array_length()` |
| Indexing | Impl‑dependent | GIN (`jsonb`) | generated cols | computed cols | expression index |

---

## Key Gotchas

- PostgreSQL ARRAY indexing is **1‑based**, JSON paths are **0‑based**.
- MySQL, SQL Server, SQLite emulate arrays using JSON.
- SQLite has no JSON type but built‑in JSON functions and JSONB storage.
- For joins & filters, always shred JSON arrays into rows.

