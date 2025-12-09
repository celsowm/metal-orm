#!/usr/bin/env node
import path from 'path';
import process from 'process';
import fs from 'fs';
import os from 'os';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

import {
  SqliteDialect,
  PostgresDialect,
  MySqlDialect,
  SqlServerDialect,
  Orm,
  OrmSession
} from '../dist/index.js';

const require = createRequire(import.meta.url);
const useStdin = process.argv.includes('--stdin');

const usage = `Usage: npm run show-sql -- <builder-module> [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate] [--e2e]
       npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate] [--e2e] < code.mjs
       cat code.mjs | npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate] [--e2e]

The module should export either:
  - default: SelectQueryBuilder instance
  - builder: SelectQueryBuilder instance
  - build(): SelectQueryBuilder (sync or async)

Example builder module:
  import { SelectQueryBuilder, defineTable, col } from '../dist/index.js';
  const users = defineTable('users', { id: col.primaryKey(col.int()), name: col.varchar(255) });
  export const build = () => new SelectQueryBuilder(users).select({ id: users.columns.id }).limit(5);

Example stdin usage:
  npm run show-sql -- --stdin <<'EOF'
  import { SelectQueryBuilder, defineTable, col } from './dist/index.js';
  const users = defineTable('users', { id: col.primaryKey(col.int()), name: col.varchar(255) });
  export default new SelectQueryBuilder(users).select({ id: users.columns.id }).limit(5);
  EOF

Options:
  --hydrate   Executes the builder and prints hydrated results (requires sqlite3 if dialect=sqlite).
  --e2e       Shortcut to execute the builder (like --hydrate) even when you mainly want SQL output; auto-installs sqlite3 to a temp dir if missing.
  --db        Use a specific SQLite database file instead of the in-memory seeded database.
`;

const args = process.argv.slice(2);
const modulePath = args.find(a => !a.startsWith('--'));
const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1] ?? 'sqlite';
const dbPathArg = args.find(a => a.startsWith('--db='))?.split('=')[1];
const hydrate = args.includes('--hydrate');
const e2e = args.includes('--e2e');
const shouldExecute = hydrate || e2e || !!dbPathArg;
const isSqliteDialect = dialectArg.toLowerCase() === 'sqlite';

if (!modulePath && !useStdin) {
  console.error(usage);
  process.exit(1);
}

const dialect = (() => {
  switch (dialectArg.toLowerCase()) {
    case 'sqlite':
      return new SqliteDialect();
    case 'postgres':
    case 'pg':
      return new PostgresDialect();
    case 'mysql':
      return new MySqlDialect();
    case 'mssql':
    case 'sqlserver':
      return new SqlServerDialect();
    default:
      console.warn(`Unknown dialect "${dialectArg}", defaulting to sqlite.`);
      return new SqliteDialect();
  }
})();

const readStdin = () => {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
};

const transformImports = (code) => {
  // Transform relative imports to absolute file URLs
  const cwd = process.cwd();
  return code.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, relativePath) => {
      const absolutePath = path.resolve(cwd, relativePath);
      const fileUrl = pathToFileURL(absolutePath).href;
      return `from '${fileUrl}'`;
    }
  );
};


const loadBuilder = async () => {
  if (useStdin) {
    const code = await readStdin();
    if (!code.trim()) {
      console.error('No code provided via stdin.');
      process.exit(1);
    }

    // Transform relative imports to absolute file URLs
    const transformedCode = transformImports(code);

    // Create a data URL module from the code
    const dataUrl = `data:text/javascript;base64,${Buffer.from(transformedCode).toString('base64')}`;
    const mod = await import(dataUrl);

    const candidate = mod.default ?? mod.builder ?? mod.build;
    if (typeof candidate === 'function') {
      return await candidate();
    }
    return candidate;
  }

  const resolved = path.resolve(modulePath);
  const mod = await import(pathToFileURL(resolved).href);

  const candidate = mod.default ?? mod.builder ?? mod.build;
  if (typeof candidate === 'function') {
    return await candidate();
  }
  return candidate;
};

const builder = await loadBuilder();
if (!builder || typeof builder.execute !== 'function') {
  console.error('Builder module must export a SelectQueryBuilder instance or a function that returns one.');
  process.exit(1);
}

// --- SQLite Support & Execution Logic ---

let sqlite3 = null;
const sqliteTempDir = path.join(os.tmpdir(), 'metal-orm-sqlite');

const tryRequireSqlite3 = () => {
  const candidatePaths = [undefined, process.cwd(), sqliteTempDir];
  for (const candidate of candidatePaths) {
    try {
      const resolved = candidate
        ? require.resolve('sqlite3', { paths: [candidate] })
        : require.resolve('sqlite3');
      return require(resolved);
    } catch {
      /* try next path */
    }
  }
  return null;
};

const installSqlite3Temp = () => {
  fs.mkdirSync(sqliteTempDir, { recursive: true });
  const resolvedNpmCli = (() => {
    try {
      return require.resolve('npm/bin/npm-cli.js');
    } catch {
      const bundled = path.join(
        path.dirname(process.execPath),
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js'
      );
      if (fs.existsSync(bundled)) {
        return bundled;
      }
      return process.env.npm_execpath;
    }
  })();

  const npmCommand = resolvedNpmCli ? process.execPath
    : process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm';

  const npmArgs = resolvedNpmCli
    ? [resolvedNpmCli, 'install', 'sqlite3', '--no-save', '--no-package-lock', '--prefix', sqliteTempDir]
    : ['install', 'sqlite3', '--no-save', '--no-package-lock', '--prefix', sqliteTempDir];

  const result = spawnSync(npmCommand, npmArgs, {
    stdio: 'inherit'
  });

  if (result.error) {
    throw new Error(`Failed to install sqlite3: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Failed to install sqlite3 (exit code ${result.status ?? 'unknown'}).`);
  }

  const mod = tryRequireSqlite3();
  if (!mod) {
    throw new Error('sqlite3 installation completed but module could not be required.');
  }
  return mod;
};

const ensureSqlite3 = () => {
  if (sqlite3) return sqlite3;

  const existing = tryRequireSqlite3();
  if (existing) {
    sqlite3 = existing;
    return sqlite3;
  }

  if (!isSqliteDialect || !shouldExecute) {
    return null;
  }

  console.log('sqlite3 not found; installing locally for SQLite execution (no package.json changes)...');
  sqlite3 = installSqlite3Temp();
  return sqlite3;
};

const getSeedSql = () => {
  try {
    const seedPath = path.join(process.cwd(), 'playground/shared/playground/data/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf8');
    // Extract content between backticks
    const match = content.match(/`([\s\S]*)`/);
    return match ? match[1] : null;
  } catch (e) {
    console.warn('Could not load seed data:', e.message);
    return null;
  }
};

const initDb = async () => {
  const sqlite = ensureSqlite3();
  if (!sqlite) {
    console.error("SQLite support requires 'sqlite3'. Please install it to use this feature.");
    process.exit(1);
  }

  const dbLocation = dbPathArg || ':memory:';
  const db = new sqlite.Database(dbLocation);

  if (!dbPathArg) {
    // If using in-memory (or no specific DB file provided), try to load seed data
    const seedSql = getSeedSql();
    if (seedSql) {
      await new Promise((resolve, reject) => {
        db.exec(seedSql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  return db;
};

let dbInstance = null;

const executor = {
  async executeSql(sql, params) {
    if (!shouldExecute) {
      return [];
    }

    if (!dbInstance) {
      dbInstance = await initDb();
    }

    return new Promise((resolve, reject) => {
      dbInstance.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const safeRows = rows ?? [];
        const columns = safeRows.length ? Object.keys(safeRows[0]) : [];
        const values = safeRows.map(row => columns.map(col => row[col]));

        resolve([{ columns, values }]);
      });
    });
  }
};

const factory = {
  createExecutor: () => executor,
  createTransactionalExecutor: () => executor
};
const orm = new Orm({ dialect, executorFactory: factory });
const session = new OrmSession({
  orm,
  executor,
  queryLogger(entry) {
    console.log('\n--- SQL ---');
    console.log(entry.sql);
    if (entry.params?.length) {
      console.log('Params:', entry.params);
    }
    console.log('-----------');
  }
});

try {
  const result = await builder.execute(session);
  if (shouldExecute) {
    console.log('\n--- Results ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------');
  }
} catch (err) {
  console.error('\nError executing query:', err.message);
  process.exit(1);
}
