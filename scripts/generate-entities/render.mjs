import path from 'node:path';
import { createNamingStrategy } from '../naming-strategy.mjs';
import { buildSchemaMetadata } from './schema.mjs';

const escapeJsString = value => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const sanitizePropertyName = columnName => {
  if (!columnName) return '';
  return columnName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_$]/g, '_')
    .replace(/^[0-9]/, '_$&');
};

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

const formatDefaultValueForDoc = value => {
  const normalized = normalizeDefault(value);
  if (!normalized) return null;
  const code = normalized.code;
  if (typeof code !== 'string') {
    return `${code}`;
  }
  if (normalized.kind === 'raw') {
    const trimmed = code.trim();
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  return code;
};

const buildColumnRemarks = column => {
  const notes = [];
  if (column.autoIncrement) {
    notes.push('Auto-increment identity column');
  }
  if (column.generated) {
    const verb = column.generated === 'always' ? 'Generated always' : 'Generated by default';
    notes.push(`${verb} column`);
  }
  if (column.check) {
    notes.push(`Check constraint: ${column.check}`);
  }
  if (column.references) {
    const ref = column.references;
    const actions = [];
    if (ref.onDelete) actions.push(`on delete ${ref.onDelete}`);
    if (ref.onUpdate) actions.push(`on update ${ref.onUpdate}`);
    const actionSuffix = actions.length ? ` (${actions.join(', ')})` : '';
    notes.push(`References ${ref.table}.${ref.column}${actionSuffix}`);
  }
  if (!notes.length) return null;
  return notes.join('; ');
};

const buildColumnDoc = column => {
  const entries = [];
  if (column.comment) {
    entries.push(column.comment);
  }
  const defaultValue = formatDefaultValueForDoc(column.default);
  if (defaultValue) {
    entries.push(`@defaultValue ${defaultValue}`);
  }
  const remarks = buildColumnRemarks(column);
  if (remarks) {
    entries.push(`@remarks ${remarks}`);
  }
  if (!entries.length) return null;
  return entries.join('\n');
};

const renderColumnExpression = (column, tablePk, tableSchema, defaultSchema, propertyName) => {
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

  if (column.name !== propertyName) {
    expr = `{ ...${expr}, name: '${escapeJsString(column.name)}' }`;
  }

  return {
    decorator,
    expr,
    tsType,
    optional,
    comment: buildColumnDoc(column)
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
  'BelongsToReference',
  'ManyToManyCollection',
  'bootstrapEntities',
  'getTableDefFromEntity',
  'Tree',
  'TreeParent',
  'TreeChildren'
];

const renderEntityClassLines = ({ table, className, naming, relations, resolveClassName, defaultSchema, treeConfig }) => {
  const lines = [];
  const derivedDefault = naming.defaultTableNameFromClass(className);
  const needsTableNameOption = table.name !== derivedDefault;
  const isView = table.isView === true;

  const entityOptParts = [];
  if (needsTableNameOption) {
    entityOptParts.push(`tableName: '${escapeJsString(table.name)}'`);
  }
  if (isView) {
    entityOptParts.push(`type: 'view'`);
  }
  const entityOpts = entityOptParts.length > 0 ? `{ ${entityOptParts.join(', ')} }` : '';

  if (table.comment) {
    appendJsDoc(lines, table.comment);
  }
  
  // Add @Tree decorator if this is a tree table
  if (treeConfig) {
    const treeOptParts = [
      `parentKey: '${escapeJsString(treeConfig.parentKey)}'`,
      `leftKey: '${escapeJsString(treeConfig.leftKey)}'`,
      `rightKey: '${escapeJsString(treeConfig.rightKey)}'`,
    ];
    if (treeConfig.depthKey) {
      treeOptParts.push(`depthKey: '${escapeJsString(treeConfig.depthKey)}'`);
    }
    if (treeConfig.scope && treeConfig.scope.length > 0) {
      treeOptParts.push(`scope: [${treeConfig.scope.map(s => `'${escapeJsString(s)}'`).join(', ')}]`);
    }
    lines.push(`@Tree({ ${treeOptParts.join(', ')} })`);
  }
  
  lines.push(`@Entity(${entityOpts})`);
  lines.push(`export class ${className} {`);

  for (const col of table.columns) {
    const propertyName = sanitizePropertyName(col.name);
    const rendered = renderColumnExpression(col, table.primaryKey, table.schema, defaultSchema, propertyName);
    appendJsDoc(lines, rendered.comment, '  ');
    // Views always use @Column (no PrimaryKey) and readonly properties
    const decorator = isView ? 'Column' : rendered.decorator;
    const readonlyPrefix = isView ? 'readonly ' : '';
    lines.push(`  @${decorator}(${rendered.expr})`);
    lines.push(`  ${readonlyPrefix}${propertyName}${rendered.optional ? '?:' : '!:'} ${rendered.tsType};`);
    lines.push('');
  }

  for (const rel of relations) {
    const targetClass = resolveClassName(rel.target);
    if (!targetClass) continue;
    const propName = naming.applyRelationOverride(className, rel.property);
    switch (rel.kind) {
      case 'belongsTo':
        lines.push(
          `  @BelongsTo({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
        );
        lines.push(`  ${propName}!: BelongsToReference<${targetClass}>;`);
        lines.push('');
        break;
      case 'hasMany':
        lines.push(
          `  @HasMany({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
        );
        lines.push(`  ${propName}!: HasManyCollection<${targetClass}>;`);
        lines.push('');
        break;
      case 'hasOne':
        lines.push(
          `  @HasOne({ target: () => ${targetClass}, foreignKey: '${escapeJsString(rel.foreignKey)}' })`
        );
        lines.push(`  ${propName}!: HasOneReference<${targetClass}>;`);
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
        lines.push(`  ${propName}!: ManyToManyCollection<${targetClass}>;`);
        lines.push('');
        break;
      }
      default:
        break;
    }
  }

  // Add TreeParent and TreeChildren decorators if this is a tree table
  if (treeConfig) {
    lines.push('');
    lines.push(`  @TreeParent()`);
    lines.push(`  parent?: ${className};`);
    lines.push('');
    lines.push(`  @TreeChildren()`);
    lines.push(`  children?: ${className}[];`);
  }
  
  lines.push('}');
  lines.push('');
  return lines;
};

const computeTableUsage = (table, relations, defaultSchema, treeConfig) => {
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
    needsBelongsToReference: false,
    needsManyToManyCollection: false,
    needsTreeDecorator: false,
    needsTreeParentDecorator: false,
    needsTreeChildrenDecorator: false
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
      usage.needsBelongsToReference = true;
    }
    if (rel.kind === 'belongsToMany') {
      usage.needsBelongsToManyDecorator = true;
      usage.needsManyToManyCollection = true;
    }
  }

  if (treeConfig) {
    usage.needsTreeDecorator = true;
    usage.needsTreeParentDecorator = true;
    usage.needsTreeChildrenDecorator = true;
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
  if (usage.needsBelongsToReference) names.add('BelongsToReference');
  if (usage.needsManyToManyCollection) names.add('ManyToManyCollection');
  if (usage.needsTreeDecorator) names.add('Tree');
  if (usage.needsTreeParentDecorator) names.add('TreeParent');
  if (usage.needsTreeChildrenDecorator) names.add('TreeChildren');
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
  const { tables, views, relations } = metadata;
  const allEntities = [...tables, ...views];

  const aggregateUsage = {
    needsCol: false,
    needsEntity: allEntities.length > 0,
    needsColumnDecorator: false,
    needsPrimaryKeyDecorator: false,
    needsHasManyDecorator: false,
    needsHasOneDecorator: false,
    needsBelongsToDecorator: false,
    needsBelongsToManyDecorator: false,
    needsHasManyCollection: false,
    needsHasOneReference: false,
    needsBelongsToReference: false,
    needsManyToManyCollection: false,
    needsTreeDecorator: false,
    needsTreeParentDecorator: false,
    needsTreeChildrenDecorator: false
  };

  for (const table of tables) {
    const rels = relations.get(table.name) || [];
    const treeConfig = metadata.treeConfigs.get(table.name) || null;
    const tableUsage = computeTableUsage(table, rels, options.schema, treeConfig);
    aggregateUsage.needsCol ||= tableUsage.needsCol;
    aggregateUsage.needsColumnDecorator ||= tableUsage.needsColumnDecorator;
    aggregateUsage.needsPrimaryKeyDecorator ||= tableUsage.needsPrimaryKeyDecorator;
    aggregateUsage.needsHasManyDecorator ||= tableUsage.needsHasManyDecorator;
    aggregateUsage.needsHasOneDecorator ||= tableUsage.needsHasOneDecorator;
    aggregateUsage.needsBelongsToDecorator ||= tableUsage.needsBelongsToDecorator;
    aggregateUsage.needsBelongsToManyDecorator ||= tableUsage.needsBelongsToManyDecorator;
    aggregateUsage.needsHasManyCollection ||= tableUsage.needsHasManyCollection;
    aggregateUsage.needsHasOneReference ||= tableUsage.needsHasOneReference;
    aggregateUsage.needsBelongsToReference ||= tableUsage.needsBelongsToReference;
    aggregateUsage.needsManyToManyCollection ||= tableUsage.needsManyToManyCollection;
    aggregateUsage.needsTreeDecorator ||= tableUsage.needsTreeDecorator;
    aggregateUsage.needsTreeParentDecorator ||= tableUsage.needsTreeParentDecorator;
    aggregateUsage.needsTreeChildrenDecorator ||= tableUsage.needsTreeChildrenDecorator;
  }

  // Views only need col and Column decorator
  for (const view of views) {
    if (view.columns.length > 0) {
      aggregateUsage.needsCol = true;
      aggregateUsage.needsColumnDecorator = true;
    }
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

  for (const entity of allEntities) {
    const className = metadata.classNames.get(entity.name);
    const classLines = renderEntityClassLines({
      table: entity,
      className,
      naming,
      relations: relations.get(entity.name) || [],
      resolveClassName: metadata.resolveClassName,
      defaultSchema: options.schema,
      treeConfig: metadata.treeConfigs.get(entity.name) || null
    });
    lines.push(...classLines);
  }

  lines.push(
    'export const bootstrapEntityTables = () => {',
    '  const tables = bootstrapEntities();',
    '  return {',
    ...allEntities.map(t => `    ${metadata.classNames.get(t.name)}: getTableDefFromEntity(${metadata.classNames.get(t.name)})!,`),
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
  const allEntities = [...metadata.tables, ...metadata.views];

  for (const entity of allEntities) {
    const className = metadata.classNames.get(entity.name);
    const relations = metadata.relations.get(entity.name) || [];
    const isView = entity.isView === true;

    const treeConfig = metadata.treeConfigs.get(entity.name) || null;
    let metalImportNames;
    if (isView) {
      // Views only need col, Entity and Column
      metalImportNames = new Set();
      if (entity.columns.length > 0) {
        metalImportNames.add('col');
        metalImportNames.add('Entity');
        metalImportNames.add('Column');
      }
    } else {
       const usage = computeTableUsage(entity, relations, options.schema, treeConfig);
      metalImportNames = getMetalOrmImportNamesFromUsage(usage);
    }
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
      table: entity,
      className,
      naming,
      relations,
      resolveClassName: metadata.resolveClassName,
      defaultSchema: options.schema,
      treeConfig: treeConfig
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

  const allEntities = [...metadata.tables, ...metadata.views];
  const exportedClasses = [];
  for (const entity of allEntities) {
    const className = metadata.classNames.get(entity.name);
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
    ...allEntities.map(
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
