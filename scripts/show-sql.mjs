#!/usr/bin/env node
import path from 'path';
import process from 'process';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';

import {
  OrmContext,
  SqliteDialect,
  PostgresDialect,
  MySqlDialect,
  SqlServerDialect
} from '../dist/index.js';

const require = createRequire(import.meta.url);
const useStdin = process.argv.includes('--stdin');

const usage = `Usage: npm run show-sql -- <builder-module> [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate]
       npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate] < code.mjs
       cat code.mjs | npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql] [--db=path/to/db.sqlite] [--hydrate]

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
`;

const args = process.argv.slice(2);
const modulePath = args.find(a => !a.startsWith('--'));
const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1] ?? 'sqlite';
const dbPathArg = args.find(a => a.startsWith('--db='))?.split('=')[1];
const hydrate = args.includes('--hydrate');

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

let sqlite3;
try {
  sqlite3 = require('sqlite3');
} catch (e) {
  console.error('Failed to require sqlite3:', e);
}

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
  if (!sqlite3) {
    console.error("SQLite support requires 'sqlite3'. Please install it to use this feature.");
    process.exit(1);
  }

  const dbLocation = dbPathArg || ':memory:';
  const db = new sqlite3.Database(dbLocation);

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
    if (!hydrate && !dbPathArg) {
      return [];
    }

    if (!dbInstance) {
      dbInstance = await initDb();
    }

    return new Promise((resolve, reject) => {
      dbInstance.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
};

const ctx = new OrmContext({
  dialect,
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
  const result = await builder.execute(ctx);
  if (hydrate || dbPathArg) {
    console.log('\n--- Results ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('---------------');
  }
} catch (err) {
  console.error('\nError executing query:', err.message);
  process.exit(1);
}
