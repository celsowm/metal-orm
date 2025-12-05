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

const usage = `Usage: npm run show-sql -- <builder-module> [--dialect=sqlite|postgres|mysql|mssql]

The module should export either:
  - default: SelectQueryBuilder instance
  - builder: SelectQueryBuilder instance
  - build(): SelectQueryBuilder (sync or async)

Example builder module:
  import { SelectQueryBuilder, defineTable, col } from '../dist/index.js';
  const users = defineTable('users', { id: col.primaryKey(col.int()), name: col.varchar(255) });
  export const build = () => new SelectQueryBuilder(users).select({ id: users.columns.id }).limit(5);
`;

const args = process.argv.slice(2);
const modulePath = args.find(a => !a.startsWith('--'));
const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1] ?? 'sqlite';

if (!modulePath) {
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

const loadBuilder = async () => {
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

const logged = [];
const executor = {
  async executeSql(sql, params) {
    logged.push({ sql, params });
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

if (logged.length === 0) {
  console.warn('No SQL executed. Did the builder include lazy relations only?');
}
