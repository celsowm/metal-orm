#!/usr/bin/env node
import path from 'path';
import process from 'process';
import fs from 'fs';
import {
  SqliteDialect
} from '../dist/index.js';
import { generateCode } from './generate-code.js';
import { toPascalCase } from './utils.js';
import os from 'os';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const usage = `Usage: npm run generate-level3 -- [--dialect=sqlite] [--db=path/to/db.sqlite] [--output=path/to/output/dir]

Generates Level 3 decorator-based entities from a SQLite database schema.

Options:
  --dialect   The database dialect to use (only sqlite is supported).
  --db        Path to the SQLite database file.
  --output    The directory to write the generated entity files to.

NOTE: This script requires the 'sqlite3' package to be installed.
`;

const args = process.argv.slice(2);
const dialectArg = args.find(a => a.startsWith('--dialect='))?.split('=')[1] ?? 'sqlite';
const dbPathArg = args.find(a => a.startsWith('--db='))?.split('=')[1];
const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1];

if (!dbPathArg || !outputArg) {
  console.error(usage);
  process.exit(1);
}

if (dialectArg.toLowerCase() !== 'sqlite') {
    console.error('Error: Only the sqlite dialect is currently supported.');
    process.exit(1);
}

const dialect = new SqliteDialect();

console.log('Generating Level 3 entities...');
console.log(`Dialect: ${dialectArg}`);
console.log(`Database: ${dbPathArg}`);
console.log(`Output directory: ${outputArg}`);

const SCHEMA_QUERIES = {
  sqlite: {
    tables: `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    columns: (tableName) => `PRAGMA table_info('${tableName}')`,
    foreignKeys: (tableName) => `PRAGMA foreign_key_list('${tableName}')`,
  },
  // Other dialects to be added here
};

const tryRequireSqlite3 = () => {
  try {
    return require('sqlite3');
  } catch (e) {
    return null;
  }
};

const initDb = async () => {
  const sqlite3 = tryRequireSqlite3();
  if (!sqlite3) {
    console.error("Error: The 'sqlite3' package is required for this script. Please install it with 'npm install sqlite3'.");
    process.exit(1);
  }

  const dbLocation = dbPathArg || ':memory:';
  return new sqlite3.Database(dbLocation);
};

const getTables = async (db, dialect) => {
  return new Promise((resolve, reject) => {
    db.all(SCHEMA_QUERIES[dialect].tables, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.name));
    });
  });
};

const getColumns = async (db, dialect, tableName) => {
    return new Promise((resolve, reject) => {
        db.all(SCHEMA_QUERIES[dialect].columns(tableName), (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getForeignKeys = async (db, dialect, tableName) => {
    return new Promise((resolve, reject) => {
        db.all(SCHEMA_QUERIES[dialect].foreignKeys(tableName), (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};


const inspectSchema = async (db, dialect) => {
    const tables = await getTables(db, dialect);
    const schema = {};

    for (const table of tables) {
        const columns = await getColumns(db, dialect, table);
        const foreignKeys = await getForeignKeys(db, dialect, table);
        schema[table] = {
            columns: columns.map(c => ({
                name: c.name,
                type: c.type,
                isPrimaryKey: !!c.pk,
                isNotNull: !!c.notnull,
                defaultValue: c.dflt_value,
            })),
            foreignKeys: foreignKeys.map(fk => ({
                column: fk.from,
                referencesTable: fk.table,
                referencesColumn: fk.to,
            })),
        };
    }

    return schema;
};


const main = async () => {
  const db = await initDb();
  const schema = await inspectSchema(db, dialectArg);

  fs.mkdirSync(outputArg, { recursive: true });
  for (const tableName in schema) {
    const code = generateCode({ [tableName]: schema[tableName] }, schema);
    const className = toPascalCase(tableName);
    const fileName = `${className}.ts`;
    const filePath = path.join(outputArg, fileName);
    fs.writeFileSync(filePath, code);
  }

  db.close();
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
