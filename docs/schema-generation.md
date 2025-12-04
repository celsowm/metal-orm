# Schema Generation and DDL

MetalORM can now emit SQL DDL for your `TableDef`s so you can bootstrap databases or generate migration scripts. The generator is dialect-aware (PostgreSQL, MySQL/MariaDB, SQLite, SQL Server) and understands the richer schema metadata on columns, tables, and indexes.

## Capabilities

- Column features: `notNull`, `unique`, `default`, `autoIncrement/identity`, `check`, and `references` with `onDelete`/`onUpdate` actions.
- Table features: composite `primaryKey`, secondary `indexes` (unique + filtered where supported), table `checks`, `comment`, and dialect hints (`engine`, `charset`, `collation`).
- Dialects: Postgres uses `IDENTITY` by default, MySQL uses `AUTO_INCREMENT`, SQLite uses inline `PRIMARY KEY AUTOINCREMENT` when possible, SQL Server uses `IDENTITY`.
- Ordering: tables are emitted in dependency order based on foreign keys.

## Quick start

```ts
import { defineTable, col } from 'metal-orm';
import { PostgresSchemaDialect, generateSchemaSql } from 'metal-orm';

const users = defineTable(
  'users',
  {
    id: col.autoIncrement(col.primaryKey(col.int())),
    email: col.unique(col.varchar(180)),
    name: col.notNull(col.varchar(120)),
    role: col.default(col.varchar(50), 'user')
  },
  {},
  undefined,
  {
    indexes: [
      { name: 'users_role_idx', columns: ['role'] }
    ]
  }
);

const dialect = new PostgresSchemaDialect();
const statements = generateSchemaSql([users], dialect);
console.log(statements.join('\n'));
```

You can also generate per-table SQL:

```ts
import { generateCreateTableSql } from 'metal-orm';
const { tableSql, indexSql } = generateCreateTableSql(users, dialect);
```

## Safety notes

- Partial/filtered indexes are only allowed on dialects that support them (Postgres, SQL Server). Others will throw if `where` is provided.
- SQLite autoincrement requires a single-column integer primary key; the generator automatically inlines `PRIMARY KEY AUTOINCREMENT` in that case and skips a separate PK constraint.
- Defaults are rendered as literals; use `col.defaultRaw(...)` if you need expressions (e.g., `col.defaultRaw(col.timestamp(), 'CURRENT_TIMESTAMP')`).

## Next steps

Upcoming iterations will add full schema introspection; today you can already diff/apply if you provide a `DatabaseSchema` snapshot.

## Diff & sync (preview)

```ts
import {
  diffSchema,
  synchronizeSchema,
  PostgresSchemaDialect,
  generateSchemaSql,
  introspectSchema,
} from 'metal-orm';
import { defineTable, col } from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(180)),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  user_id: col.notNull(col.int()),
});

const dialect = new PostgresSchemaDialect();

// Introspect the live database (Postgres in this example)
const actualSchema = await introspectSchema(executor, 'postgres', { schema: 'public' });

const plan = diffSchema([users, posts], actualSchema, dialect, { allowDestructive: false });

// plan.changes contains ordered SQL you can run manually
for (const change of plan.changes) {
  change.statements.forEach(sql => console.log(sql));
}

// Or apply automatically
await synchronizeSchema([users, posts], actualSchema, dialect, executor, { allowDestructive: false });
```

`allowDestructive` gates drops; `dryRun` skips execution while still producing the plan. Partial/filtered indexes are emitted only for dialects that support them (Postgres, SQL Server). `introspectSchema` works for Postgres, MySQL/MariaDB, SQLite, and SQL Server; you can scope by schema/database or include/exclude tables.
