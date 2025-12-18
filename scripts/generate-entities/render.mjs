import path from 'node:path';
import { createNamingStrategy } from '../naming-strategy.mjs';
import { buildSchemaMetadata } from './schema.mjs';

const escapeJsString = value => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const formatJsDoc = comment => {
  if (!comment) return null;
  const normalized = comment.replace(/\r\n?/g, '\n').trim();
  if (!normalized) return null;
  const lines = normalized.split('\n').map(line => line.replace(/\*\//g, '*\\/'));
  return ['/**', ...lines.map(line => ` * ${line}`), ' */'].join('\n');
};

const appendJsDoc = (lines, comment, indent = '') => {
  const doc = formatJsDoc(comment);
  if (!doc) return;
  doc.split('\n').forEach(line => lines.push(`${indent}${line}`));
};

const normalizeReferenceTable = (refTable, sourceSchema, defaultSchema) => {
  if (!refTable || typeof refTable !== 'string') return refTable;
  const parts = refTable.split('.');
  if (parts.length === 1) return refTable;

  if (parts.length === 2) {
    const [schema, table] = parts;
    return schema === sourceSchema || (defaultSchema && schema === defaultSchema) ? table : refTable;
  }

  if (parts.length === 3) {
    const [db, schema, table] = parts;
    if (schema === sourceSchema || (defaultSchema && schema === defaultSchema)) {
      return `${db}.${table}`;
    }
    return refTable;
  }

  return refTable;
};

const parseColumnType = colTypeRaw => {
  const type = (colTypeRaw || '').toLowerCase();
  const lengthMatch = type.match(/\((\d+)(?:\s*,\s*(\d+))?\)/);
  const length = lengthMatch ? Number(lengthMatch[1]) : undefined;
  const scale = lengthMatch && lengthMatch[2] ? Number(lengthMatch[2]) : undefined;
  const isMaxLength = /\(max\)/.test(type);

  const base = type.replace(/\(.*\)/, '');

  if (base === 'bit') return { factory: 'col.boolean()', ts: 'boolean' };
  if (base.includes('bigint')) return { factory: 'col.bigint()', ts: 'number' };
  if (base.includes('int')) return { factory: 'col.int()', ts: 'number' };
  if (base.includes('uuid') || base.includes('uniqueidentifier')) return { factory: 'col.uuid()', ts: 'string' };
  if (base === 'date') return { factory: 'col.date<Date>()', ts: 'Date' };
  if (base.includes('datetime') || base === 'time') return { factory: 'col.datetime<Date>()', ts: 'Date' };
  if (base.includes('text') || (isMaxLength && base.includes('char'))) return { factory: 'col.text()', ts: 'string' };
  if (base.includes('char')) {
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

const renderColumnExpression = (column, tablePk, tableSchema, defaultSchema) => {
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
    const refTable = normalizeReferenceTable(column.references.table, tableSchema, defaultSchema);
    const refParts = [
      `table: '${escapeJsString(refTable)}'`,
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
    optional,
    comment: column.comment
  };
};

const METAL_ORM_IMPORT_ORDER = [
  'col',
  'Entity',
  'Column',
  'PrimaryKey',
  'HasMany',
  'HasOne',
  'BelongsTo',
  'BelongsToMany',
  'HasManyCollection',
  'HasOneReference',
  'ManyToManyCollection',
  'bootstrapEntities',
  'getTableDefFromEntity'
];

const renderEntityClassLines = ({ table, className, naming, relations, resolveClassName, defaultSchema }) => {
  const lines = [];
  const derivedDefault = naming.defaultTableNameFromClass(className);
  const needsTableNameOption = table.name !== derivedDefault;
  const entityOpts = needsTableNameOption ? `{ tableName: '${escapeJsString(table.name)}' }` : '';
  if (table.comment) {
    appendJsDoc(lines, table.comment);
  }
  lines.push(`@Entity(${entityOpts})`);
  lines.push(`export class ${className} {`);

  for (const col of table.columns) {
    const rendered = renderColumnExpression(col, table.primaryKey, table.schema, defaultSchema);
    appendJsDoc(lines, rendered.comment, '  ');
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
      case 'hasOne':
        lines.push(
          `  @HasOne({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
        );
        lines.push(`  ${rel.property}!: HasOneReference<${targetClass}>;`);
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

const computeTableUsage = (table, relations, defaultSchema) => {
  const usage = {
    needsCol: false,
    needsEntity: true,
    needsColumnDecorator: false,
    needsPrimaryKeyDecorator: false,
    needsHasManyDecorator: false,
    needsHasOneDecorator: false,
    needsBelongsToDecorator: false,
    needsBelongsToManyDecorator: false,
    needsHasManyCollection: false,
    needsHasOneReference: false,
    needsManyToManyCollection: false
  };

  for (const col of table.columns) {
    usage.needsCol = true;
    const rendered = renderColumnExpression(col, table.primaryKey, table.schema, defaultSchema);
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
    if (rel.kind === 'hasOne') {
      usage.needsHasOneDecorator = true;
      usage.needsHasOneReference = true;
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
  if (usage.needsHasOneDecorator) names.add('HasOne');
  if (usage.needsBelongsToDecorator) names.add('BelongsTo');
  if (usage.needsBelongsToManyDecorator) names.add('BelongsToMany');
  if (usage.needsHasManyCollection) names.add('HasManyCollection');
  if (usage.needsHasOneReference) names.add('HasOneReference');
  if (usage.needsManyToManyCollection) names.add('ManyToManyCollection');
  return names;
};

const buildMetalOrmImportStatement = names => {
  if (!names || names.size === 0) return '';
  const ordered = METAL_ORM_IMPORT_ORDER.filter(name => names.has(name));
  if (!ordered.length) return '';
  return `import { ${ordered.join(', ')} } from 'metal-orm';`;
};

const appendJsExtension = (specifier, useExtension) => (useExtension ? `${specifier}.js` : specifier);

const getRelativeModuleSpecifier = (from, to, extension = '') => {
  const rel = path.relative(path.dirname(from), to).replace(/\\/g, '/');
  if (!rel) {
    return './';
  }
  const withoutExt = rel.replace(/\.ts$/i, '');
  const normalized = withoutExt.startsWith('.') ? withoutExt : `./${withoutExt}`;
  return `${normalized}${extension}`;
};

export const renderEntityFile = (schema, options) => {
  const naming = options.naming || createNamingStrategy('en');
  const metadata = buildSchemaMetadata(schema, naming);
  const { tables, relations } = metadata;

  const aggregateUsage = {
    needsCol: false,
    needsEntity: tables.length > 0,
    needsColumnDecorator: false,
    needsPrimaryKeyDecorator: false,
    needsHasManyDecorator: false,
    needsHasOneDecorator: false,
    needsBelongsToDecorator: false,
    needsBelongsToManyDecorator: false,
    needsHasManyCollection: false,
    needsHasOneReference: false,
    needsManyToManyCollection: false
  };

  for (const table of tables) {
    const rels = relations.get(table.name) || [];
    const tableUsage = computeTableUsage(table, rels, options.schema);
    aggregateUsage.needsCol ||= tableUsage.needsCol;
    aggregateUsage.needsColumnDecorator ||= tableUsage.needsColumnDecorator;
    aggregateUsage.needsPrimaryKeyDecorator ||= tableUsage.needsPrimaryKeyDecorator;
    aggregateUsage.needsHasManyDecorator ||= tableUsage.needsHasManyDecorator;
    aggregateUsage.needsHasOneDecorator ||= tableUsage.needsHasOneDecorator;
    aggregateUsage.needsBelongsToDecorator ||= tableUsage.needsBelongsToDecorator;
    aggregateUsage.needsBelongsToManyDecorator ||= tableUsage.needsBelongsToManyDecorator;
    aggregateUsage.needsHasManyCollection ||= tableUsage.needsHasManyCollection;
    aggregateUsage.needsHasOneReference ||= tableUsage.needsHasOneReference;
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
      resolveClassName: metadata.resolveClassName,
      defaultSchema: options.schema
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

export const renderSplitEntityFiles = (schema, options) => {
  const naming = options.naming || createNamingStrategy('en');
  const metadata = buildSchemaMetadata(schema, naming);
  const tableFiles = [];

  for (const table of metadata.tables) {
    const className = metadata.classNames.get(table.name);
    const relations = metadata.relations.get(table.name) || [];
    const usage = computeTableUsage(table, relations, options.schema);
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
      const specifier = appendJsExtension(`./${targetClass}`, options.useJsImportExtensions);
      importLines.push(`import { ${targetClass} } from '${specifier}';`);
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
      resolveClassName: metadata.resolveClassName,
      defaultSchema: options.schema
    });
    lines.push(...classLines);

    tableFiles.push({
      path: path.join(options.outDir, `${className}.ts`),
      code: lines.join('\n')
    });
  }

  return { tableFiles, metadata };
};

export const renderSplitIndexFile = (metadata, options) => {
  const importLines = ["import { bootstrapEntities, getTableDefFromEntity } from 'metal-orm';"];

  const exportedClasses = [];
  for (const table of metadata.tables) {
    const className = metadata.classNames.get(table.name);
    const filePath = path.join(options.outDir, `${className}.ts`);
    const moduleSpecifier = getRelativeModuleSpecifier(
      options.out,
      filePath,
      options.useJsImportExtensions ? '.js' : ''
    );
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
