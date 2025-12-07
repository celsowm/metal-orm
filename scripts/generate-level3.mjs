#!/usr/bin/env node
import process from 'process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { getSchemaIntrospector } from '../dist/index.js';
import { generateCode } from './generate-code.js';
import { toPascalCase } from './utils.js';

const require = createRequire(import.meta.url);

const usage = `Usage: npm run generate-level3 -- --dialect=<dialect> [--db=<db_path>] [--output=<output_dir>]

Generates Level 3 decorator-based entities from a database schema.

Options:
  --dialect   The database dialect to use (sqlite, postgres, mysql, mssql).
  --db        Path to the SQLite database file.
  --output    The directory to write the generated entity files to.

NOTE: This script requires the appropriate database driver to be installed (e.g., 'sqlite3', 'pg', 'mysql2', 'tedious').
`;

const args = process.argv.slice(2);
const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1];
const dbPathArg = args.find(a => a.startsWith('--db='))?.split('=')[1];
const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1] ?? './gen';

if (!dialectArg) {
  console.error(usage);
  process.exit(1);
}

const getDriver = async () => {
  switch (dialectArg) {
    case 'sqlite':
      return (await import('sqlite3')).default;
    case 'postgres':
      return (await import('pg')).default;
    case 'mysql':
      return (await import('mysql2')).default;
    case 'mssql':
      return (await import('tedious')).default;
    default:
      console.error(`Unsupported dialect: ${dialectArg}`);
      process.exit(1);
  }
};

const createExecutor = (driver) => {
  if (dialectArg === 'sqlite') {
    const db = new driver.Database(dbPathArg);
    return {
      executeSql: (sql, params) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          const safeRows = rows ?? [];
          const columns = safeRows.length ? Object.keys(safeRows[0]) : [];
          const values = safeRows.map(row => columns.map(col => row[col]));
          resolve([{ columns, values }]);
        });
      }),
    };
  }
  // TODO: Implement executors for other dialects
  console.error(`Executor for dialect '${dialectArg}' is not implemented yet.`);
  process.exit(1);
};


export const main = async (args) => {
  const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1];
  const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1] ?? './gen';

  const introspector = getSchemaIntrospector(dialectArg);
  if (!introspector) {
    console.error(`No introspector found for dialect: ${dialectArg}`);
    process.exit(1);
  }

  const driver = await getDriver(dialectArg);
  const executor = createExecutor(driver, dialectArg);
  const schema = await introspector.introspect(executor, {});

  fs.mkdirSync(outputArg, { recursive: true });
  for (const table of schema.tables) {
    const code = generateCode({ tables: [table] }, schema);
    const className = toPascalCase(table.name);
    const fileName = `${className}.ts`;
    const filePath = path.join(outputArg, fileName);
    fs.writeFileSync(filePath, code);
  }

  console.log('Entity generation complete!');
};

if (import.meta.url === `file://${process.argv[1]}`) {
    main(process.argv.slice(2)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
