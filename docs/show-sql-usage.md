# Show-SQL Script Usage Guide

The `scripts/show-sql.mjs` script prints SQL for MetalORM query builders and, when asked, executes them (SQLite by default, auto-seeded).

## Usage methods

**File-based**
```powershell
npm run show-sql -- path/to/query.mjs --dialect=postgres
```

**Heredoc / stdin**
```powershell
@'
import { SelectQueryBuilder, defineTable, col, hasMany, eq } from './dist/index.js';

const Users = defineTable('users', { id: col.primaryKey(col.int()), name: col.varchar(255), email: col.varchar(255) });
const Orders = defineTable('orders', { id: col.primaryKey(col.int()), user_id: col.int(), total: col.decimal(10, 2), status: col.varchar(50) });
Users.relations = { orders: hasMany(Orders, 'user_id') };

export default new SelectQueryBuilder(Users)
  .selectRaw('*')
  .include('orders', { columns: ['id', 'total', 'status'] })
  .where(eq(Users.columns.id, 1))
  .limit(10);
'@ | npm run show-sql -- -- --stdin --dialect=postgres
```
Note: the double `--` separates npm args from script args.

**Pipe from file**
```powershell
Get-Content query.mjs | npm run show-sql -- -- --stdin --dialect=mysql
```

## Flags

- `--dialect=sqlite|postgres|mysql|mssql` (default: sqlite)
- `--hydrate` — execute and print hydrated results. For SQLite this uses an in-memory DB seeded from `playground/shared/playground/data/seed.ts`.
- `--e2e` — shortcut to force execution (like `--hydrate`) even if you mainly want SQL.
- `--db=path/to/db.sqlite` — execute against a specific SQLite file (skips in-memory seeding).

## SQLite auto-install (no package changes)

- If `sqlite3` is missing when using execution flags with `--dialect=sqlite`, the script will `npm install sqlite3 --no-save --no-package-lock --prefix <temp>`, where `<temp>` is `${os.tmpdir()}/metal-orm-sqlite`.
- It first tries an existing `sqlite3` in your project; manifests (`package.json` / lockfiles) are untouched.

## Supported patterns

- Relative imports are rewritten to absolute file URLs, so `./dist/index.js` works from stdin.
- All query builder features (relations, joins, CTEs) are supported.
- Use expression helpers (`eq`, `like`, etc.) in where clauses.

## Troubleshooting

- **Import/URL errors:** ensure imports are relative (e.g., `./dist/index.js`); the script rewrites them for stdin.
- **Need results:** add `--hydrate` or `--e2e`; without these (and without `--db`) it only prints SQL.
- **Custom SQLite DB:** pass `--db=./my.db` to skip the in-memory seeded database.
