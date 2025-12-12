# DB ➜ TypeScript Type Mapping in MetalORM

This note summarizes how column types map to TypeScript, and how to override them when your driver returns richer runtime values (e.g., `Date` from Tedious).

## Default mapping

| Column type                                          | Default TS type  |
| ---------------------------------------------------- | ---------------- |
| INT / INTEGER                                        | `number`         |
| BIGINT                                               | `number \| bigint` |
| DECIMAL / FLOAT / DOUBLE                             | `number`         |
| BOOLEAN                                              | `boolean`        |
| JSON                                                 | `unknown`        |
| BLOB / BINARY / VARBINARY / BYTEA                    | `Buffer`         |
| DATE / DATETIME / TIMESTAMP / TIMESTAMPTZ            | `string`         |
| Everything else                                      | `string`         |

The mapping is implemented by `ColumnToTs` in `src/schema/types.ts` and is used by `InferRow`/`EntityInstance`.

## Overriding the runtime type

Use the generics on temporal factories, or set `tsType` directly:

```ts
// Generic override on factories
const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  birthday: col.date<Date>(),          // now inferred as Date
  created_at: col.timestamp<Date>(),   // Date instead of string
});

// tsType override (works on any column)
const events = defineTable('events', {
  payload: { ...col.json(), tsType: Record<string, unknown> },
});
```

With decorators, the same applies:

```ts
@Column(col.date<Date>())
birthday!: Date;
```

If you don’t override, temporal columns stay typed as `string`.

## Dialects / drivers

MetalORM doesn’t force runtime conversions; it reflects what your driver returns. If your driver yields `Date` (e.g., Tedious), use the generic/`tsType` override above. If it yields strings (e.g., some MySQL configs), keep the default `string`.

## Tips for agents / tools

- Prefer `col.date<Date>()` / `col.datetime<Date>()` / `col.timestamp<Date>()` when using drivers that return JS `Date`.
- For custom shapes (JSON, enums mapped to unions), set `tsType` on the column definition.
- Decorator-built tables preserve `tsType` and literal column types after recent changes; `selectFromEntity` and `createEntityFromRow` now infer accordingly.
