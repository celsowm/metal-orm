#!/usr/bin/env node
/**
 * Introspects a live database and generates decorator-based entity classes.
 *
 * Usage examples:
 *   node scripts/generate-entities.mjs --dialect=postgres --url=$DATABASE_URL --schema=public --out=src/entities.ts
 *   node scripts/generate-entities.mjs --dialect=sqlite --db=./app.db --out=src/entities.ts
 *
 * Dialects supported: postgres, mysql, sqlite (mssql can be added similarly).
 */

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import {
  introspectSchema,
  createPostgresExecutor,
  createMysqlExecutor,
  createSqliteExecutor
} from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const DIALECTS = new Set(['postgres', 'mysql', 'sqlite']);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = {
    dialect: 'postgres',
    url: process.env.DATABASE_URL,
    dbPath: undefined,
    schema: undefined,
    include: undefined,
    exclude: undefined,
    out: path.join(process.cwd(), 'generated-entities.ts'),
    dryRun: false
  };

  for (const raw of args) {
    if (raw === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (raw.startsWith('--dialect=')) {
      opts.dialect = raw.split('=')[1].toLowerCase();
      continue;
    }
    if (raw.startsWith('--url=')) {
      opts.url = raw.slice('--url='.length);
      continue;
    }
    if (raw.startsWith('--db=')) {
      opts.dbPath = raw.slice('--db='.length);
      continue;
    }
    if (raw.startsWith('--schema=')) {
      opts.schema = raw.slice('--schema='.length);
      continue;
    }
    if (raw.startsWith('--include=')) {
      opts.include = raw
        .slice('--include='.length)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
      continue;
    }
    if (raw.startsWith('--exclude=')) {
      opts.exclude = raw
        .slice('--exclude='.length)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
      continue;
    }
    if (raw.startsWith('--out=')) {
      opts.out = path.resolve(process.cwd(), raw.slice('--out='.length));
      continue;
    }
    if (raw === '--help' || raw === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!DIALECTS.has(opts.dialect)) {
    throw new Error(`Unsupported dialect "${opts.dialect}". Supported: ${Array.from(DIALECTS).join(', ')}`);
  }

  if (opts.dialect === 'sqlite' && !opts.dbPath) {
    opts.dbPath = ':memory:';
  }

  if (opts.dialect !== 'sqlite' && !opts.url) {
    throw new Error('Missing connection string. Provide --url or set DATABASE_URL.');
  }

  return opts;
};

const printUsage = () => {
  console.log(
    `
MetalORM decorator generator
---------------------------
Usage:
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> [--schema=public] [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=mysql     --url=<connection> [--schema=mydb]     [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=sqlite    --db=./my.db                           [--out=src/entities.ts]

Flags:
  --include=tbl1,tbl2   Only include these tables
  --exclude=tbl3,tbl4   Exclude these tables
  --dry-run             Print to stdout instead of writing a file
  --help                Show this help
`
  );
};

const escapeJsString = value => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const toPascalCase = value =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') || 'Entity';

const toCamelCase = value => {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const singularize = name => {
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('ses')) return name.slice(0, -2);
  if (name.endsWith('s')) return name.slice(0, -1);
  return name;
};

const pluralize = name => {
  if (name.endsWith('y')) return `${name.slice(0, -1)}ies`;
  if (name.endsWith('s')) return `${name}es`;
  return `${name}s`;
};

const deriveClassName = tableName => toPascalCase(singularize(tableName));

const toSnakeCase = value =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-z0-9_]+/gi, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();

const deriveDefaultTableNameFromClass = className => {
  const normalized = toSnakeCase(className);
  if (!normalized) return 'unknown';
  return normalized.endsWith('s') ? normalized : `${normalized}s`;
};

const deriveBelongsToName = (fkName, targetTable) => {
  const trimmed = fkName.replace(/_?id$/i, '');
  const base = trimmed && trimmed !== fkName ? trimmed : singularize(targetTable);
  return toCamelCase(base);
};

const deriveHasManyName = targetTable => toCamelCase(pluralize(targetTable));
const deriveBelongsToManyName = targetTable => toCamelCase(pluralize(targetTable));

const parseColumnType = colTypeRaw => {
  const type = (colTypeRaw || '').toLowerCase();
  const lengthMatch = type.match(/\((\d+)(?:\s*,\s*(\d+))?\)/);
  const length = lengthMatch ? Number(lengthMatch[1]) : undefined;
  const scale = lengthMatch && lengthMatch[2] ? Number(lengthMatch[2]) : undefined;

  const base = type.replace(/\(.*\)/, '');

  if (base.includes('bigint')) return { factory: 'col.bigint()', ts: 'number' };
  if (base.includes('int')) return { factory: 'col.int()', ts: 'number' };
  if (base.includes('uuid')) return { factory: 'col.uuid()', ts: 'string' };
  if (base.includes('char') || base.includes('text')) {
    const lenArg = length ? `${length}` : '255';
    return { factory: `col.varchar(${lenArg})`, ts: 'string' };
  }
  if (base.includes('json')) return { factory: 'col.json()', ts: 'any' };
  if (base.includes('bool') || (base.includes('tinyint') && length === 1)) {
    return { factory: 'col.boolean()', ts: 'boolean' };
  }
  if (base.includes('date') || base.includes('time')) return { factory: 'col.datetime()', ts: 'Date' };
  if (base.includes('decimal') || base.includes('numeric')) {
    const precision = length ?? 10;
    const scaleVal = scale ?? 0;
    return { factory: `col.decimal(${precision}, ${scaleVal})`, ts: 'number' };
  }
  if (base.includes('double')) return { factory: 'col.float()', ts: 'number' };
  if (base.includes('float') || base.includes('real')) return { factory: 'col.float()', ts: 'number' };
  if (base.includes('blob') || base.includes('binary') || base.includes('bytea')) {
    return { factory: 'col.blob()', ts: 'Buffer' };
  }

  return { factory: `col.varchar(255) /* TODO: review type ${colTypeRaw} */`, ts: 'any' };
};

const normalizeDefault = value => {
  if (value === undefined) return undefined;
  if (value === null) return { kind: 'value', code: 'null' };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { kind: 'value', code: JSON.stringify(value) };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[-]?\d+(\.\d+)?$/.test(trimmed)) return { kind: 'value', code: trimmed };
    if (/^(true|false)$/i.test(trimmed)) return { kind: 'value', code: trimmed.toLowerCase() };
    if (/^null$/i.test(trimmed)) return { kind: 'value', code: 'null' };
    if (/current_|now\(\)|uuid_generate_v4|uuid\(\)/i.test(trimmed) || trimmed.includes('(')) {
      return { kind: 'raw', code: `'${escapeJsString(trimmed)}'` };
    }
    if (/^'.*'$/.test(trimmed) || /^".*"$/.test(trimmed)) {
      const unquoted = trimmed.slice(1, -1);
      return { kind: 'value', code: `'${escapeJsString(unquoted)}'` };
    }
    return { kind: 'raw', code: `'${escapeJsString(trimmed)}'` };
  }
  return { kind: 'value', code: JSON.stringify(value) };
};

const renderColumnExpression = (column, tablePk) => {
  const base = parseColumnType(column.type);
  let expr = base.factory;

  if (column.autoIncrement) {
    expr = `col.autoIncrement(${expr})`;
  }
  if (column.notNull) {
    expr = `col.notNull(${expr})`;
  }
  if (column.unique) {
    const name = typeof column.unique === 'string' ? `, '${escapeJsString(column.unique)}'` : '';
    expr = `col.unique(${expr}${name})`;
  }
  if (column.default !== undefined) {
    const def = normalizeDefault(column.default);
    if (def) {
      expr =
        def.kind === 'raw'
          ? `col.defaultRaw(${expr}, ${def.code})`
          : `col.default(${expr}, ${def.code})`;
    }
  }
  if (column.references) {
    const refParts = [
      `table: '${escapeJsString(column.references.table)}'`,
      `column: '${escapeJsString(column.references.column)}'`
    ];
    if (column.references.onDelete) refParts.push(`onDelete: '${escapeJsString(column.references.onDelete)}'`);
    if (column.references.onUpdate) refParts.push(`onUpdate: '${escapeJsString(column.references.onUpdate)}'`);
    expr = `col.references(${expr}, { ${refParts.join(', ')} })`;
  }

  const isPrimary = Array.isArray(tablePk) && tablePk.includes(column.name);
  const decorator = isPrimary ? 'PrimaryKey' : 'Column';
  const tsType = base.ts || 'any';
  const optional = !column.notNull;

  return {
    decorator,
    expr,
    tsType,
    optional
  };
};

const mapRelations = tables => {
  const relationMap = new Map();
  const relationKeys = new Map();
  const fkIndex = new Map();

  for (const table of tables) {
    relationMap.set(table.name, []);
    relationKeys.set(table.name, new Set());
    for (const col of table.columns) {
      if (col.references) {
        const list = fkIndex.get(table.name) || [];
        list.push(col);
        fkIndex.set(table.name, list);
      }
    }
  }

  const findTable = name => tables.find(t => t.name === name);

  const pivotTables = new Set();
  for (const table of tables) {
    const fkCols = fkIndex.get(table.name) || [];
    const distinctTargets = Array.from(new Set(fkCols.map(c => c.references.table)));
    if (fkCols.length === 2 && distinctTargets.length === 2) {
      const [a, b] = fkCols;
      pivotTables.add(table.name);
      const targetA = findTable(a.references.table);
      const targetB = findTable(b.references.table);
      if (targetA && targetB) {
        const aKey = relationKeys.get(targetA.name);
        const bKey = relationKeys.get(targetB.name);
        const aProp = deriveBelongsToManyName(targetB.name);
        const bProp = deriveBelongsToManyName(targetA.name);
        if (!aKey.has(aProp)) {
          aKey.add(aProp);
          relationMap.get(targetA.name)?.push({
            kind: 'belongsToMany',
            property: aProp,
            target: targetB.name,
            pivotTable: table.name,
            pivotForeignKeyToRoot: a.name,
            pivotForeignKeyToTarget: b.name
          });
        }
        if (!bKey.has(bProp)) {
          bKey.add(bProp);
          relationMap.get(targetB.name)?.push({
            kind: 'belongsToMany',
            property: bProp,
            target: targetA.name,
            pivotTable: table.name,
            pivotForeignKeyToRoot: b.name,
            pivotForeignKeyToTarget: a.name
          });
        }
      }
    }
  }

  for (const table of tables) {
    const fkCols = fkIndex.get(table.name) || [];
    for (const fk of fkCols) {
      const targetTable = fk.references.table;
      const belongsKey = relationKeys.get(table.name);
      const hasManyKey = relationKeys.get(targetTable);

      const belongsProp = deriveBelongsToName(fk.name, targetTable);
      if (!belongsKey.has(belongsProp)) {
        belongsKey.add(belongsProp);
        relationMap.get(table.name)?.push({
          kind: 'belongsTo',
          property: belongsProp,
          target: targetTable,
          foreignKey: fk.name
        });
      }

      const hasManyProp = deriveHasManyName(table.name);
      if (!hasManyKey.has(hasManyProp)) {
        hasManyKey.add(hasManyProp);
        relationMap.get(targetTable)?.push({
          kind: 'hasMany',
          property: hasManyProp,
          target: table.name,
          foreignKey: fk.name
        });
      }
    }
  }

  return relationMap;
};

const renderEntityFile = (schema, options) => {
  const tables = schema.tables.map(t => ({
    name: t.name,
    columns: t.columns,
    primaryKey: t.primaryKey || []
  }));

  const classNames = new Map();
  tables.forEach(t => classNames.set(t.name, deriveClassName(t.name)));

  const relations = mapRelations(tables);

  const imports = [
    "import { col } from 'metal-orm';",
    "import { Entity, Column, PrimaryKey, HasMany, BelongsTo, BelongsToMany, bootstrapEntities, getTableDefFromEntity } from 'metal-orm/decorators';",
    "import { HasManyCollection, ManyToManyCollection } from 'metal-orm';"
  ];

  const lines = [];
  lines.push('// AUTO-GENERATED by scripts/generate-entities.mjs');
  lines.push('// Regenerate after schema changes.');
  lines.push(...imports, '');

  for (const table of tables) {
    const className = classNames.get(table.name);
    const derivedDefault = deriveDefaultTableNameFromClass(className);
    const needsTableNameOption = table.name !== derivedDefault;
    const entityOpts = needsTableNameOption ? `{ tableName: '${escapeJsString(table.name)}' }` : '';
    lines.push(`@Entity(${entityOpts})`);
    lines.push(`export class ${className} {`);

    for (const col of table.columns) {
      const rendered = renderColumnExpression(col, table.primaryKey);
      lines.push(`  @${rendered.decorator}(${rendered.expr})`);
      lines.push(`  ${col.name}${rendered.optional ? '?:' : '!:'} ${rendered.tsType};`);
      lines.push('');
    }

    const rels = relations.get(table.name) || [];
    for (const rel of rels) {
      const targetClass = classNames.get(rel.target);
      if (!targetClass) continue;
      switch (rel.kind) {
        case 'belongsTo':
          lines.push(
            `  @BelongsTo({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
          );
          lines.push(`  ${rel.property}?: ${targetClass};`);
          lines.push('');
          break;
        case 'hasMany':
          lines.push(
            `  @HasMany({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
          );
          lines.push(`  ${rel.property}!: HasManyCollection<${targetClass}>;`);
          lines.push('');
          break;
        case 'belongsToMany':
          lines.push(
            `  @BelongsToMany({ target: () => ${targetClass}, pivotTable: () => ${classNames.get(
              rel.pivotTable
            )}, pivotForeignKeyToRoot: '${escapeJsString(rel.pivotForeignKeyToRoot)}', pivotForeignKeyToTarget: '${escapeJsString(rel.pivotForeignKeyToTarget)}' })`
          );
          lines.push(`  ${rel.property}!: ManyToManyCollection<${targetClass}>;`);
          lines.push('');
          break;
        default:
          break;
      }
    }

    lines.push('}');
    lines.push('');
  }

  lines.push(
    'export const bootstrapEntityTables = () => {',
    '  const tables = bootstrapEntities();',
    '  return {',
    ...tables.map(t => `    ${classNames.get(t.name)}: getTableDefFromEntity(${classNames.get(t.name)})!,`),
    '  };',
    '};'
  );

  lines.push('');
  lines.push(
    'export const allTables = () => bootstrapEntities();'
  );

  return lines.join('\n');
};

const loadDriver = async (dialect, url, dbPath) => {
  switch (dialect) {
    case 'postgres': {
      const mod = await import('pg');
      const { Client } = mod;
      const client = new Client({ connectionString: url });
      await client.connect();
      const executor = createPostgresExecutor(client);
      const cleanup = async () => client.end();
      return { executor, cleanup };
    }
    case 'mysql': {
      const mod = await import('mysql2/promise');
      const conn = await mod.createConnection(url);
      const executor = createMysqlExecutor({
        query: (...args) => conn.execute(...args),
        beginTransaction: () => conn.beginTransaction(),
        commit: () => conn.commit(),
        rollback: () => conn.rollback()
      });
      const cleanup = async () => conn.end();
      return { executor, cleanup };
    }
    case 'sqlite': {
      const mod = await import('sqlite3');
      const sqlite3 = mod.default || mod;
      const db = new sqlite3.Database(dbPath);
      const execAll = (sql, params) =>
        new Promise((resolve, reject) => {
          db.all(sql, params || [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          });
        });
      const executor = createSqliteExecutor({
        all: execAll,
        beginTransaction: () => execAll('BEGIN'),
        commitTransaction: () => execAll('COMMIT'),
        rollbackTransaction: () => execAll('ROLLBACK')
      });
      const cleanup = async () =>
        new Promise((resolve, reject) => db.close(err => (err ? reject(err) : resolve())));
      return { executor, cleanup };
    }
    default:
      throw new Error(`Unsupported dialect ${dialect}`);
  }
};

const main = async () => {
  const opts = parseArgs();

  const { executor, cleanup } = await loadDriver(opts.dialect, opts.url, opts.dbPath);
  let schema;
  try {
    schema = await introspectSchema(executor, opts.dialect, {
      schema: opts.schema,
      includeTables: opts.include,
      excludeTables: opts.exclude
    });
  } finally {
    await cleanup?.();
  }

  const code = renderEntityFile(schema, opts);

  if (opts.dryRun) {
    console.log(code);
    return;
  }

  await fs.promises.mkdir(path.dirname(opts.out), { recursive: true });
  await fs.promises.writeFile(opts.out, code, 'utf8');
  console.log(`Wrote ${opts.out} (${schema.tables.length} tables)`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
