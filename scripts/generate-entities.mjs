#!/usr/bin/env node
/**
 * Introspects a live database and generates decorator-based entity classes.
 *
 * Usage examples:
 *   node scripts/generate-entities.mjs --dialect=postgres --url=$DATABASE_URL --schema=public --include=users,orders --out=src/entities.ts
 *   node scripts/generate-entities.mjs --dialect=mysql --url=$DATABASE_URL --exclude=archived --out=src/entities.ts
 *   node scripts/generate-entities.mjs --dialect=sqlite --db=./app.db --out=src/entities.ts
 *
 * Dialects supported: postgres, mysql, sqlite, mssql.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { parseOptions, printUsage } from './generate-entities/cli.mjs';
import { generateEntities } from './generate-entities/generate.mjs';

const pkgVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const isEntrypoint =
  typeof process.argv?.[1] === 'string' && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

const main = async () => {
  const result = parseOptions(process.argv.slice(2), process.env, process.cwd());
  if (result.kind === 'help') {
    printUsage();
    return;
  }
  if (result.kind === 'version') {
    console.log(`metal-orm ${pkgVersion}`);
    return;
  }
  await generateEntities(result.options);
};

if (isEntrypoint) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

export { mapRelations, buildSchemaMetadata } from './generate-entities/schema.mjs';
export { renderEntityFile } from './generate-entities/render.mjs';
