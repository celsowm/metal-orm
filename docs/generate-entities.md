# Generating Entities from an Existing Database

If you already ran `npm install metal-orm`, the helper script at `scripts/generate-entities.mjs` ships inside the package. Run it from your app (or wire it into an npm script) so MetalORM can introspect a live database and emit decorator-based entity classes that match your current schema.

Prefer the bundled CLI alias (requires Node 18+):

```bash
npx metal-orm-gen -- \
  --dialect=postgres \
  --url=postgres://user:pass@host/db \
  --schema=public \
  --out=src/entities.ts
```

## Run the script

Call the bundled helper through the npm alias (it forwards to `scripts/generate-entities.mjs`):

```bash
npm run gen:entities -- \
  --dialect=postgres \
  --url=postgres://user:pass@host/db \
  --schema=public \
  --out=src/entities.ts
```

If you prefer, set `DATABASE_URL` (or the dialect-appropriate env var) and omit `--url`:

```bash
DATABASE_URL=postgres://user:pass@host/db \
  npm run gen:entities -- \
  --dialect=postgres \
  --schema=public \
  --out=src/entities.ts
```

If you prefer to invoke the script directly, point Node at the shipped file:

```bash
node ./node_modules/metal-orm/scripts/generate-entities.mjs \
  --dialect=postgres \
  --url=postgres://user:pass@host/db \
  --schema=public \
  --out=src/entities.ts
```

The script:

1. Loads the dialect-specific driver that you already installed alongside `metal-orm`.
2. Connects to your database and runs `introspectSchema` from `metal-orm/dist`.
3. Emits an entity file that imports `col`, decorator helpers, and the `HasManyCollection` / `ManyToManyCollection` helpers.

The default output is `generated-entities.ts` in your current working directory, but you can override it via `--out=path/to/file.ts`.

## Key flags

| Flag | Meaning |
| --- | --- |
| `--dialect=(postgres|mysql|sqlite|mssql)` | Choose the driver. Defaults to `postgres`. |
| `--url=<connection>` | Connection string for Postgres, MySQL/MariaDB, or SQL Server. Required unless you point at SQLite. |
| `--db=<path>` | SQLite file path (defaults to `:memory:` when you omit this flag). |
| `--schema=<name>` | Schema (or catalog) to introspect. |
| `--include=tbl1,tbl2` | Whitelist tables to emit. |
| `--exclude=tbl3,tbl4` | Skip specific tables. |
| `--locale=pt-BR` | Naming locale for class and relation names (default: `en`). |
| `--naming-overrides=path/to/file.json` | JSON map of irregular plurals to merge into the locale strategy. |
| `--out=<file>` | Where to dump the generated code (default: `generated-entities.ts`). |
| `--dry-run` | Print the generated source to stdout instead of writing a file. |
| `--help` | Show the usage text inside the script. |

You can also rely on the `DATABASE_URL` environment variable instead of `--url`.

## Output notes

The generated file:

- Converts every table into an `@Entity()` class whose name is derived from the table name (singularized + PascalCase).
- Decorates columns with `@Column` or `@PrimaryKey`, applies `col.xxx()` helpers, marks nullability, defines defaults, and wires up foreign keys.
- Adds relations automatically: `@BelongsTo`, `@HasMany`, and `@BelongsToMany` decorators that point at the other generated classes.
- Infers foreign keys/index metadata from each supported dialect so the generated decorators can emit `col.references`/`@BelongsTo`/`@HasMany` (even across schemas) without extra wiring.
- Detects boolean-friendly types like `tinyint(1)`/`bit` and surfaces them as `col.boolean()` instead of `col.int()`, keeping defaults such as `((1))` intact.
- Exports `bootstrapEntityTables()` so you can bootstrap and reuse the same table definitions when wiring up repositories right after `bootstrapEntities()`.
- Adds `allTables()` as a convenience wrapper around `bootstrapEntities()`.

The script also preserves the real table name when it cannot be derived from the class name by passing `tableName` to `@Entity()`.

## Naming locale and irregulars

The generator now supports locale-aware pluralization for class names and relation properties:

```bash
# Portuguese pluralization (estado_solicitacao -> estadoSolicitacoes)
npm run gen:entities -- --locale=pt-BR --schema=public --out=src/entities.ts

# Merge project-specific irregulars
npm run gen:entities -- \
  --locale=pt-BR \
  --naming-overrides=./naming-irregulars.json \
  --schema=public \
  --out=src/entities.ts
```

`--naming-overrides` expects a JSON object mapping singular to plural. You can wrap it in an `irregulars` object or pass the map directly:

```json
{
  "irregulars": {
    "solicitacao": "solicitacoes",
    "mao": "maos"
  }
}
```

Portuguese includes a few common irregulars out of the box (`mao → maos`, `pao → paes`, `cao → caes`, `mal → males`, `consul → consules`). Add your own irregulars for domain terms to avoid surprises; for example map `irmao` to `irmaos` or `pais` to `paises` if your schema uses those singular forms.

If you omit `--locale`, the generator defaults to English rules.

## Dialect drivers

`generate-entities.mjs` dynamically imports the driver for the dialect you select. Install the peer dependency that corresponds to your database:

- PostgreSQL: `npm install pg`
- MySQL/MariaDB: `npm install mysql2`
- SQLite: `npm install sqlite3`
- SQL Server: `npm install tedious`

If you try to introspect without the driver, the script throws at startup because the dynamic `import` fails.

## Helpful tips

- Put the command behind an npm script if you run it often.
- Use `--include`/`--exclude` to keep generated files tidy instead of editing them manually.
- Commit the generated file and rerun the script after every schema change, like the autogenerated comment warns (`// Regenerate after schema changes.`).
- If you get a `Missing connection string` error, double-check that `DATABASE_URL` is set or that `--url` is correct.
