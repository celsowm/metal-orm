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

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs as parseCliArgs } from 'node:util';

import {
  introspectSchema,
  createPostgresExecutor,
  createMysqlExecutor,
  createSqliteExecutor,
  createMssqlExecutor
} from '../dist/index.js';

const pkgVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const DIALECTS = new Set(['postgres', 'mysql', 'sqlite', 'mssql']);

const parseArgs = () => {
  const {
    values,
    positionals
  } = parseCliArgs({
    options: {
      dialect: { type: 'string' },
      url: { type: 'string' },
      db: { type: 'string' },
      schema: { type: 'string' },
      include: { type: 'string' },
      exclude: { type: 'string' },
      out: { type: 'string' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' }
    },
    strict: true
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  if (values.version) {
    console.log(`metal-orm ${pkgVersion}`);
    process.exit(0);
  }

  if (positionals.length) {
    throw new Error(`Unexpected positional args: ${positionals.join(' ')}`);
  }

  const opts = {
    dialect: (values.dialect || 'postgres').toLowerCase(),
    url: values.url || process.env.DATABASE_URL,
    dbPath: values.db,
    schema: values.schema,
    include: values.include ? values.include.split(',').map(v => v.trim()).filter(Boolean) : undefined,
    exclude: values.exclude ? values.exclude.split(',').map(v => v.trim()).filter(Boolean) : undefined,
    out: values.out ? path.resolve(process.cwd(), values.out) : path.join(process.cwd(), 'generated-entities.ts'),
    dryRun: Boolean(values['dry-run'])
  };

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
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> --schema=public --include=users,orders [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=mysql     --url=<connection> --schema=mydb --exclude=archived [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=sqlite    --db=./my.db                           [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=mssql     --url=mssql://user:pass@host/db        [--out=src/entities.ts]

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

  if (base === 'bit') return { factory: 'col.boolean()', ts: 'boolean' };
  if (base.includes('bigint')) return { factory: 'col.bigint()', ts: 'number' };
  if (base.includes('int')) return { factory: 'col.int()', ts: 'number' };
  if (base.includes('uuid') || base.includes('uniqueidentifier')) return { factory: 'col.uuid()', ts: 'string' };
  if (base === 'date') return { factory: 'col.date()', ts: 'Date' };
  if (base.includes('datetime') || base === 'time') return { factory: 'col.datetime()', ts: 'Date' };
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

  const usage = {
    needsCol: false,
    needsEntity: tables.length > 0,
    needsColumnDecorator: false,
    needsPrimaryKeyDecorator: false,
    needsHasManyDecorator: false,
    needsBelongsToDecorator: false,
    needsBelongsToManyDecorator: false,
    needsHasManyCollection: false,
    needsManyToManyCollection: false
  };

  const lines = [];
  lines.push('// AUTO-GENERATED by scripts/generate-entities.mjs');
  lines.push('// Regenerate after schema changes.');
  const imports = [];

  for (const table of tables) {
    for (const col of table.columns) {
      usage.needsCol = true;
      const rendered = renderColumnExpression(col, table.primaryKey);
      if (rendered.decorator === 'PrimaryKey') {
        usage.needsPrimaryKeyDecorator = true;
      } else {
        usage.needsColumnDecorator = true;
      }
    }

    const rels = relations.get(table.name) || [];
    for (const rel of rels) {
      if (rel.kind === 'hasMany') {
        usage.needsHasManyDecorator = true;
        usage.needsHasManyCollection = true;
      }
      if (rel.kind === 'belongsTo') {
        usage.needsBelongsToDecorator = true;
      }
      if (rel.kind === 'belongsToMany') {
        usage.needsBelongsToManyDecorator = true;
        usage.needsManyToManyCollection = true;
      }
    }
  }

  if (usage.needsCol) {
    imports.push("import { col } from 'metal-orm';");
  }

  const decoratorSet = new Set(['bootstrapEntities', 'getTableDefFromEntity']);
  if (usage.needsEntity) decoratorSet.add('Entity');
  if (usage.needsColumnDecorator) decoratorSet.add('Column');
  if (usage.needsPrimaryKeyDecorator) decoratorSet.add('PrimaryKey');
  if (usage.needsHasManyDecorator) decoratorSet.add('HasMany');
  if (usage.needsBelongsToDecorator) decoratorSet.add('BelongsTo');
  if (usage.needsBelongsToManyDecorator) decoratorSet.add('BelongsToMany');
  const decoratorOrder = [
    'Entity',
    'Column',
    'PrimaryKey',
    'HasMany',
    'BelongsTo',
    'BelongsToMany',
    'bootstrapEntities',
    'getTableDefFromEntity'
  ];
  const decoratorImports = decoratorOrder.filter(name => decoratorSet.has(name));
  if (decoratorImports.length) {
    imports.push(`import { ${decoratorImports.join(', ')} } from 'metal-orm';`);
  }

  const ormTypes = [];
  if (usage.needsHasManyCollection) ormTypes.push('HasManyCollection');
  if (usage.needsManyToManyCollection) ormTypes.push('ManyToManyCollection');
  if (ormTypes.length) {
    imports.push(`import { ${ormTypes.join(', ')} } from 'metal-orm';`);
  }

  if (imports.length) {
    lines.push(...imports, '');
  }

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

const parseSqlServerConnectionConfig = connectionString => {
  if (!connectionString) {
    throw new Error('Missing connection string for SQL Server');
  }
  const url = new URL(connectionString);
  const config = {
    server: url.hostname,
    authentication: {
      type: 'default',
      options: {
        userName: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || '')
      }
    },
    options: {}
  };

  const database = url.pathname ? url.pathname.replace(/^\//, '') : '';
  if (database) {
    config.options.database = database;
  }
  if (url.port) {
    config.options.port = Number(url.port);
  }

  for (const [key, value] of url.searchParams) {
    config.options[key] = parseSqlServerOptionValue(value);
  }

  return config;
};

const parseSqlServerOptionValue = value => {
  if (!value) return value;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  return value;
};

const getTediousParameterType = (value, TYPES) => {
  if (value === null || value === undefined) {
    return TYPES.NVarChar;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TYPES.Int : TYPES.Float;
  }
  if (typeof value === 'bigint') {
    return TYPES.BigInt;
  }
  if (typeof value === 'boolean') {
    return TYPES.Bit;
  }
  if (value instanceof Date) {
    return TYPES.DateTime;
  }
  if (Buffer.isBuffer(value)) {
    return TYPES.VarBinary;
  }
  return TYPES.NVarChar;
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
    case 'mssql': {
      const mod = await import('tedious');
      const { Connection, Request, TYPES } = mod;
      const config = parseSqlServerConnectionConfig(url);
      const connection = new Connection(config);

      await new Promise((resolve, reject) => {
        const onConnect = err => {
          connection.removeListener('error', onError);
          if (err) return reject(err);
          resolve();
        };
        const onError = err => {
          connection.removeListener('connect', onConnect);
          reject(err);
        };
        connection.once('connect', onConnect);
        connection.once('error', onError);
        // Tedious requires an explicit connect() call to start the handshake.
        connection.connect();
      });

      const execQuery = (sql, params) =>
        new Promise((resolve, reject) => {
          const rows = [];
          const request = new Request(sql, err => {
            if (err) return reject(err);
            resolve({ recordset: rows });
          });
          request.on('row', columns => {
            const row = {};
            for (const column of columns) {
              row[column.metadata.colName] = column.value;
            }
            rows.push(row);
          });
          params?.forEach((value, index) => {
            request.addParameter(`p${index + 1}`, getTediousParameterType(value, TYPES), value);
          });
          connection.execSql(request);
        });

      const executor = createMssqlExecutor({
        query: execQuery,
        beginTransaction: () =>
          new Promise((resolve, reject) => {
            connection.beginTransaction(err => (err ? reject(err) : resolve()));
          }),
        commit: () =>
          new Promise((resolve, reject) => {
            connection.commitTransaction(err => (err ? reject(err) : resolve()));
          }),
        rollback: () =>
          new Promise((resolve, reject) => {
            connection.rollbackTransaction(err => (err ? reject(err) : resolve()));
          })
      });

      const cleanup = async () =>
        new Promise((resolve, reject) => {
          const onEnd = () => {
            connection.removeListener('error', onError);
            resolve();
          };
          const onError = err => {
            connection.removeListener('end', onEnd);
            reject(err);
          };
          connection.once('end', onEnd);
          connection.once('error', onError);
          connection.close();
        });

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

  await fs.mkdir(path.dirname(opts.out), { recursive: true });
  await fs.writeFile(opts.out, code, 'utf8');
  console.log(`Wrote ${opts.out} (${schema.tables.length} tables)`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
