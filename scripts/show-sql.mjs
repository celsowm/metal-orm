#!/usr/bin/env node
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';

import {
  OrmContext,
  SqliteDialect,
  PostgresDialect,
  MySqlDialect,
  SqlServerDialect
} from '../dist/index.js';

const useStdin = process.argv.includes('--stdin');

const usage = `Usage: npm run show-sql -- <builder-module> [--dialect=sqlite|postgres|mysql|mssql]
       npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql] < code.mjs
       cat code.mjs | npm run show-sql -- --stdin [--dialect=sqlite|postgres|mysql|mssql]

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

const executor = {
  async executeSql(sql, params) {
    return [];
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

await builder.execute(ctx);
