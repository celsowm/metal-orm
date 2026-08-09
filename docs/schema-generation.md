# Schema Generation and DDL

MetalORM can emit SQL DDL for your `TableDef`s so you can bootstrap databases or generate migration scripts. The generator is dialect-aware (PostgreSQL, MySQL/MariaDB, SQLite, SQL Server) and understands the richer schema metadata on columns, tables, and indexes.

## Capabilities

- Column features: `notNull`, `unique`, `default`, `autoIncrement/identity`, `check`, and `references` with `onDelete`/`onUpdate` actions.
- Table features: composite `primaryKey`, secondary `indexes` (unique + filtered where supported), table `checks`, `comment`, and dialect hints (`engine`, `charset`, `collation`).
- Dialects: Postgres uses `IDENTITY` by default, MySQL uses `AUTO_INCREMENT`, SQLite uses inline `PRIMARY KEY AUTOINCREMENT` when possible, SQL Server uses `IDENTITY`.
- Ordering: tables are emitted in dependency order based on foreign keys.

## Quick start

```ts
import {
  defineTable,
  col,
  createPostgresSchemaDialect,
  generateSchemaSql
} from 'metal-orm';

const users = defineTable(
  'users',
  {
    id: col.autoIncrement(col.primaryKey(col.int())),
    email: col.unique(col.varchar(180)),
    name: col.notNull(col.varchar(120)),
    role: col.default(col.varchar(50), 'user')
  },
  {},
  {
    indexes: [
      { name: 'users_role_idx', columns: ['role'] }
    ]
  }
);

const dialect = createPostgresSchemaDialect();
const statements = generateSchemaSql([users], dialect);
console.log(statements.join('\n'));
```

The class facades (`new PostgresSchemaDialect()`, `new MySqlSchemaDialect()`, `new SQLiteSchemaDialect()`, `new MSSqlSchemaDialect()`) remain available as ergonomic construction syntax, but built-in DDL compilation is assembled by composition rather than inheritance.

You can also generate per-table SQL:

```ts
import { generateCreateTableSql } from 'metal-orm';
const { tableSql, indexSql } = generateCreateTableSql(users, dialect);
```

## Schema dialect composition

`SchemaDialect` is a structural contract. There is no schema-dialect base class. `composeSchemaDialect()` combines the common DDL mechanics with backend-specific functions and explicit mutation capabilities.

```ts
import {
  composeSchemaDialect,
  createLiteralFormatter,
  type SchemaDialect
} from 'metal-orm';

const oracle: SchemaDialect = composeSchemaDialect({
  name: 'oracle',
  quoteIdentifier: id => `"${id}"`,
  literalFormatter: createLiteralFormatter(),
  renderColumnType: column => String(column.type),
  renderAutoIncrement: () => undefined,
  renderIndex: (table, index, services) =>
    `CREATE INDEX ${services.quoteIdentifier(index.name ?? 'idx')} ` +
    `ON ${services.formatTableName(table)} (...);`
});
```

Destructive and alter operations are represented by `dialect.mutations`:

```ts
if (dialect.mutations.dropColumn) {
  const sql = dialect.mutations.dropColumn.compile(actualTable, 'legacy_column');
}
```

Absence means the operation is unsupported. MetalORM no longer requires fake `alterColumn`/`dropColumn` implementations that return empty arrays, and `diffSchema()` never blindly calls an optional mutation method.

## Safety notes

- Partial/filtered indexes are supported by PostgreSQL, SQLite, and SQL Server. MySQL rejects `where` indexes.
- SQLite autoincrement requires a single-column integer primary key; the generator automatically inlines `PRIMARY KEY AUTOINCREMENT` in that case and skips a separate PK constraint.
- SQLite does not expose direct `ALTER COLUMN` or `DROP COLUMN` mutation capabilities in MetalORM; schema diff emits a warning and leaves the operation for an explicit table-rebuild/manual migration.
- Defaults are rendered as literals; use `col.defaultRaw(...)` if you need expressions (e.g., `col.defaultRaw(col.timestamp(), 'CURRENT_TIMESTAMP')`).

## Diff & sync

```ts
import {
  diffSchema,
  synchronizeSchema,
  createPostgresSchemaDialect,
  introspectSchema,
  defineTable,
  col
} from 'metal-orm';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  email: col.unique(col.varchar(180))
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  user_id: col.notNull(col.int())
});

const dialect = createPostgresSchemaDialect();
const actualSchema = await introspectSchema(executor, 'postgres', { schema: 'public' });
const plan = diffSchema([users, posts], actualSchema, dialect, { allowDestructive: false });

for (const change of plan.changes) {
  change.statements.forEach(sql => console.log(sql));
}

await synchronizeSchema(
  [users, posts],
  actualSchema,
  dialect,
  executor,
  { allowDestructive: false }
);
```

`allowDestructive` gates drops; `dryRun` skips execution while still producing the plan. If a requested change has no matching mutation capability, the plan keeps the change visible with no executable statements and includes a warning instead of failing at runtime. `introspectSchema` works for Postgres, MySQL/MariaDB, SQLite, and SQL Server; you can scope by schema/database or include/exclude tables.

## Comment metadata

`introspectSchema` reads table/column descriptions and fills `DatabaseTable.comment` / `DatabaseColumn.comment` so the generator can keep your documentation in sync with the schema. Postgres pulls `COMMENT ON`, MySQL/MariaDB uses the `COMMENT` clause, SQL Server reads the `MS_Description` extended property, and SQLite can populate comments from an optional `schema_comments` metadata table you maintain.

```sql
CREATE TABLE IF NOT EXISTS schema_comments (
  object_type TEXT CHECK(object_type IN ('table','column')) NOT NULL,
  schema_name TEXT,
  table_name TEXT NOT NULL,
  column_name TEXT,
  comment TEXT NOT NULL,
  PRIMARY KEY (object_type, schema_name, table_name, column_name)
);
```

## Custom introspection strategies

Schema introspection is already a separate strategy from query and DDL compilation. You can register a custom introspector independently:

```ts
import {
  registerSchemaIntrospector,
  introspectSchema
} from 'metal-orm';

registerSchemaIntrospector('oracle', {
  async introspect(executor, options) {
    void executor;
    void options;
    return { tables: [] };
  }
});

await introspectSchema(executor, 'oracle', {});
```

The three backend responsibilities therefore remain independent: query dialect, schema dialect, and schema introspector.
