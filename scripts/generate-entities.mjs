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
import { createNamingStrategy } from './naming-strategy.mjs';

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
      locale: { type: 'string' },
      'naming-overrides': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'out-dir': { type: 'string' },
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
    out: values.out ? path.resolve(process.cwd(), values.out) : undefined,
    outDir: values['out-dir'] ? path.resolve(process.cwd(), values['out-dir']) : undefined,
    locale: (values.locale || 'en').toLowerCase(),
    namingOverrides: values['naming-overrides']
      ? path.resolve(process.cwd(), values['naming-overrides'])
      : undefined,
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

  if (!opts.out) {
    opts.out = opts.outDir ? path.join(opts.outDir, 'index.ts') : path.join(process.cwd(), 'generated-entities.ts');
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
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> --schema=public --out-dir=src/entities

Flags:
  --include=tbl1,tbl2   Only include these tables
  --exclude=tbl3,tbl4   Exclude these tables
  --locale=pt-BR        Naming locale for class/relation names (default: en)
  --naming-overrides    Path to JSON map of irregular plurals { "singular": "plural" }
  --dry-run             Print to stdout instead of writing a file
  --out=<file>          Override the generated file (defaults to generated-entities.ts or the index inside --out-dir)
  --out-dir=<dir>       Emit one file per entity inside this directory plus the shared index
  --help                Show this help
`
  );
};

const escapeJsString = value => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const loadIrregulars = async filePath => {
  const raw = await fs.readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse naming overrides at ${filePath}: ${err.message || err}`);
  }
  const irregulars =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.irregulars && typeof parsed.irregulars === 'object' && !Array.isArray(parsed.irregulars)
        ? parsed.irregulars
        : parsed
      : undefined;
  if (!irregulars) {
    throw new Error(`Naming overrides at ${filePath} must be an object or { "irregulars": { ... } }`);
  }
  return irregulars;
};

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
  if (base === 'date') return { factory: 'col.date<Date>()', ts: 'Date' };
  if (base.includes('datetime') || base === 'time') return { factory: 'col.datetime<Date>()', ts: 'Date' };
  if (base.includes('char') || base.includes('text')) {
    const lenArg = length ? `${length}` : '255';
    return { factory: `col.varchar(${lenArg})`, ts: 'string' };
  }
  if (base.includes('json')) return { factory: 'col.json()', ts: 'any' };
  if (base.includes('bool') || (base.includes('tinyint') && length === 1)) {
    return { factory: 'col.boolean()', ts: 'boolean' };
  }
  if (base.includes('date') || base.includes('time')) return { factory: 'col.datetime<Date>()', ts: 'Date' };
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

const mapRelations = (tables, naming) => {
  const normalizeName = name => (typeof name === 'string' && name.includes('.') ? name.split('.').pop() : name);
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

  const findTable = name => {
    const norm = normalizeName(name);
    return tables.find(t => t.name === name || t.name === norm);
  };

  const pivotTables = new Set();
  for (const table of tables) {
    const fkCols = fkIndex.get(table.name) || [];
    const distinctTargets = Array.from(new Set(fkCols.map(c => normalizeName(c.references.table))));
    if (fkCols.length === 2 && distinctTargets.length === 2) {
      const [a, b] = fkCols;
      pivotTables.add(table.name);
      const targetA = findTable(a.references.table);
      const targetB = findTable(b.references.table);
      if (targetA && targetB) {
        const aKey = relationKeys.get(targetA.name);
        const bKey = relationKeys.get(targetB.name);
        const aProp = naming.belongsToManyProperty(targetB.name);
        const bProp = naming.belongsToManyProperty(targetA.name);
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
      const targetKey = normalizeName(targetTable);
      const belongsKey = relationKeys.get(table.name);
      const hasManyKey = targetKey ? relationKeys.get(targetKey) : undefined;

      if (!belongsKey || !hasManyKey) continue;

      const belongsProp = naming.belongsToProperty(fk.name, targetTable);
      if (!belongsKey.has(belongsProp)) {
        belongsKey.add(belongsProp);
        relationMap.get(table.name)?.push({
          kind: 'belongsTo',
          property: belongsProp,
          target: targetTable,
          foreignKey: fk.name
        });
      }

      const hasManyProp = naming.hasManyProperty(table.name);
      if (!hasManyKey.has(hasManyProp)) {
        hasManyKey.add(hasManyProp);
        relationMap.get(targetKey)?.push({
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

const METAL_ORM_IMPORT_ORDER = [
  'col',
  'Entity',
  'Column',
  'PrimaryKey',
  'HasMany',
  'BelongsTo',
  'BelongsToMany',
  'HasManyCollection',
  'ManyToManyCollection',
  'bootstrapEntities',
  'getTableDefFromEntity'
];

const buildSchemaMetadata = (schema, naming) => {
  const tables = schema.tables.map(t => ({
    name: t.name,
    schema: t.schema,
    columns: t.columns,
    primaryKey: t.primaryKey || []
  }));

  const classNames = new Map();
  tables.forEach(t => {
    const className = naming.classNameFromTable(t.name);
    classNames.set(t.name, className);
    if (t.schema) {
      const qualified = `${t.schema}.${t.name}`;
      if (!classNames.has(qualified)) {
        classNames.set(qualified, className);
      }
    }
  });

  const resolveClassName = target => {
    if (!target) return undefined;
    if (classNames.has(target)) return classNames.get(target);
    const fallback = target.split('.').pop();
    if (fallback && classNames.has(fallback)) {
      return classNames.get(fallback);
    }
    return undefined;
  };

  const relations = mapRelations(tables, naming);

  return {
    tables,
    classNames,
    relations,
    resolveClassName
  };
};

const renderEntityClassLines = ({ table, className, naming, relations, resolveClassName }) => {
  const lines = [];
  const derivedDefault = naming.defaultTableNameFromClass(className);
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

  for (const rel of relations) {
    const targetClass = resolveClassName(rel.target);
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
      case 'belongsToMany': {
        const pivotClass = resolveClassName(rel.pivotTable);
        if (!pivotClass) break;
        lines.push(
          `  @BelongsToMany({ target: () => ${targetClass}, pivotTable: () => ${pivotClass}, pivotForeignKeyToRoot: '${escapeJsString(
            rel.pivotForeignKeyToRoot
          )}', pivotForeignKeyToTarget: '${escapeJsString(rel.pivotForeignKeyToTarget)}' })`
        );
        lines.push(`  ${rel.property}!: ManyToManyCollection<${targetClass}>;`);
        lines.push('');
        break;
      }
      default:
        break;
    }
  }

  lines.push('}');
  lines.push('');
  return lines;
};

const computeTableUsage = (table, relations) => {
  const usage = {
    needsCol: false,
    needsEntity: true,
    needsColumnDecorator: false,
    needsPrimaryKeyDecorator: false,
    needsHasManyDecorator: false,
    needsBelongsToDecorator: false,
    needsBelongsToManyDecorator: false,
    needsHasManyCollection: false,
    needsManyToManyCollection: false
  };

  for (const col of table.columns) {
    usage.needsCol = true;
    const rendered = renderColumnExpression(col, table.primaryKey);
    if (rendered.decorator === 'PrimaryKey') {
      usage.needsPrimaryKeyDecorator = true;
    } else {
      usage.needsColumnDecorator = true;
    }
  }

  for (const rel of relations) {
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

  return usage;
};

const getMetalOrmImportNamesFromUsage = usage => {
  const names = new Set();
  if (usage.needsCol) names.add('col');
  if (usage.needsEntity) names.add('Entity');
  if (usage.needsColumnDecorator) names.add('Column');
  if (usage.needsPrimaryKeyDecorator) names.add('PrimaryKey');
  if (usage.needsHasManyDecorator) names.add('HasMany');
  if (usage.needsBelongsToDecorator) names.add('BelongsTo');
  if (usage.needsBelongsToManyDecorator) names.add('BelongsToMany');
  if (usage.needsHasManyCollection) names.add('HasManyCollection');
  if (usage.needsManyToManyCollection) names.add('ManyToManyCollection');
  return names;
};

const buildMetalOrmImportStatement = names => {
  if (!names || names.size === 0) return '';
  const ordered = METAL_ORM_IMPORT_ORDER.filter(name => names.has(name));
  if (!ordered.length) return '';
  return `import { ${ordered.join(', ')} } from 'metal-orm';`;
};

const getRelativeModuleSpecifier = (from, to) => {
  const rel = path.relative(path.dirname(from), to).replace(/\\/g, '/');
  if (!rel) return './';
  const withoutExt = rel.replace(/\.ts$/i, '');
  return withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
};

const renderEntityFile = (schema, options) => {
  const naming = options.naming || createNamingStrategy('en');
  const metadata = buildSchemaMetadata(schema, naming);
  const { tables, relations } = metadata;

  const aggregateUsage = {
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

  for (const table of tables) {
    const rels = relations.get(table.name) || [];
    const tableUsage = computeTableUsage(table, rels);
    aggregateUsage.needsCol ||= tableUsage.needsCol;
    aggregateUsage.needsColumnDecorator ||= tableUsage.needsColumnDecorator;
    aggregateUsage.needsPrimaryKeyDecorator ||= tableUsage.needsPrimaryKeyDecorator;
    aggregateUsage.needsHasManyDecorator ||= tableUsage.needsHasManyDecorator;
    aggregateUsage.needsBelongsToDecorator ||= tableUsage.needsBelongsToDecorator;
    aggregateUsage.needsBelongsToManyDecorator ||= tableUsage.needsBelongsToManyDecorator;
    aggregateUsage.needsHasManyCollection ||= tableUsage.needsHasManyCollection;
    aggregateUsage.needsManyToManyCollection ||= tableUsage.needsManyToManyCollection;
  }

  const importNames = getMetalOrmImportNamesFromUsage(aggregateUsage);
  importNames.add('bootstrapEntities');
  importNames.add('getTableDefFromEntity');
  const importStatement = buildMetalOrmImportStatement(importNames);

  const lines = [
    '// AUTO-GENERATED by scripts/generate-entities.mjs',
    '// Regenerate after schema changes.'
  ];
  if (importStatement) {
    lines.push(importStatement, '');
  }

  for (const table of tables) {
    const className = metadata.classNames.get(table.name);
    const classLines = renderEntityClassLines({
      table,
      className,
      naming,
      relations: relations.get(table.name) || [],
      resolveClassName: metadata.resolveClassName
    });
    lines.push(...classLines);
  }

  lines.push(
    'export const bootstrapEntityTables = () => {',
    '  const tables = bootstrapEntities();',
    '  return {',
    ...tables.map(t => `    ${metadata.classNames.get(t.name)}: getTableDefFromEntity(${metadata.classNames.get(t.name)})!,`),
    '  };',
    '};',
    '',
    'export const allTables = () => bootstrapEntities();'
  );

  return lines.join('\n');
};

const renderSplitEntityFiles = (schema, options) => {
  const naming = options.naming || createNamingStrategy('en');
  const metadata = buildSchemaMetadata(schema, naming);
  const tableFiles = [];

  for (const table of metadata.tables) {
    const className = metadata.classNames.get(table.name);
    const relations = metadata.relations.get(table.name) || [];
    const usage = computeTableUsage(table, relations);
    const metalImportNames = getMetalOrmImportNamesFromUsage(usage);
    const metalImportStatement = buildMetalOrmImportStatement(metalImportNames);

    const relationImports = new Set();
    for (const rel of relations) {
      const targetClass = metadata.resolveClassName(rel.target);
      if (targetClass && targetClass !== className) {
        relationImports.add(targetClass);
      }
      if (rel.kind === 'belongsToMany') {
        const pivotClass = metadata.resolveClassName(rel.pivotTable);
        if (pivotClass && pivotClass !== className) {
          relationImports.add(pivotClass);
        }
      }
    }

    const importLines = [];
    if (metalImportStatement) {
      importLines.push(metalImportStatement);
    }
    for (const targetClass of Array.from(relationImports).sort()) {
      importLines.push(`import { ${targetClass} } from './${targetClass}';`);
    }

    const lines = [
      '// AUTO-GENERATED by scripts/generate-entities.mjs',
      '// Regenerate after schema changes.'
    ];
    if (importLines.length) {
      lines.push(...importLines, '');
    }

    const classLines = renderEntityClassLines({
      table,
      className,
      naming,
      relations,
      resolveClassName: metadata.resolveClassName
    });
    lines.push(...classLines);

    tableFiles.push({
      path: path.join(options.outDir, `${className}.ts`),
      code: lines.join('\n')
    });
  }

  return { tableFiles, metadata };
};

const renderSplitIndexFile = (metadata, options) => {
  const importLines = [
    "import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm';"
  ];

  const exportedClasses = [];
  for (const table of metadata.tables) {
    const className = metadata.classNames.get(table.name);
    const filePath = path.join(options.outDir, `${className}.ts`);
    const moduleSpecifier = getRelativeModuleSpecifier(options.out, filePath);
    importLines.push(`import { ${className} } from '${moduleSpecifier}';`);
    exportedClasses.push(className);
  }

  const lines = [
    '// AUTO-GENERATED by scripts/generate-entities.mjs',
    '// Regenerate after schema changes.',
    ...importLines,
    ''
  ];

  if (exportedClasses.length) {
    lines.push('export {');
    for (const className of exportedClasses) {
      lines.push(`  ${className},`);
    }
    lines.push('};', '');
  }

  lines.push(
    'export const bootstrapEntityTables = () => {',
    '  const tables = bootstrapEntities();',
    '  return {',
    ...metadata.tables.map(
      t =>
        `    ${metadata.classNames.get(t.name)}: getTableDefFromEntity(${metadata.classNames.get(t.name)})!,`
    ),
    '  };',
    '};',
    '',
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
  const irregulars = opts.namingOverrides ? await loadIrregulars(opts.namingOverrides) : undefined;
  const naming = createNamingStrategy(opts.locale, irregulars);

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

  if (opts.outDir) {
    const { tableFiles, metadata } = renderSplitEntityFiles(schema, { ...opts, naming });
    const indexCode = renderSplitIndexFile(metadata, { ...opts, naming });

    if (opts.dryRun) {
      for (const file of tableFiles) {
        console.log(`\n==> ${file.path}\n`);
        console.log(file.code);
      }
      console.log(`\n==> ${opts.out}\n`);
      console.log(indexCode);
      return;
    }

    await fs.mkdir(opts.outDir, { recursive: true });
    for (const file of tableFiles) {
      await fs.writeFile(file.path, file.code, 'utf8');
    }
    await fs.mkdir(path.dirname(opts.out), { recursive: true });
    await fs.writeFile(opts.out, indexCode, 'utf8');
    console.log(`Wrote ${tableFiles.length} entity files to ${opts.outDir} and index ${opts.out} (${schema.tables.length} tables)`);
  } else {
    const code = renderEntityFile(schema, { ...opts, naming });

    if (opts.dryRun) {
      console.log(code);
      return;
    }

    await fs.mkdir(path.dirname(opts.out), { recursive: true });
    await fs.writeFile(opts.out, code, 'utf8');
    console.log(`Wrote ${opts.out} (${schema.tables.length} tables)`);
  }
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
