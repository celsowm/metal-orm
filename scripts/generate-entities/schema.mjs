const normalizeName = name => (typeof name === 'string' && name.includes('.') ? name.split('.').pop() : name);

export const mapRelations = (tables, naming) => {
  const relationMap = new Map();
  const relationKeys = new Map();
  const fkIndex = new Map();
  const uniqueSingleColumns = new Map();

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

    const uniqueCols = new Set();
    if (Array.isArray(table.primaryKey) && table.primaryKey.length === 1) {
      uniqueCols.add(table.primaryKey[0]);
    }
    for (const col of table.columns) {
      if (col.unique) uniqueCols.add(col.name);
    }
    for (const idx of table.indexes || []) {
      if (!idx?.unique) continue;
      if (!Array.isArray(idx.columns) || idx.columns.length !== 1 || !idx.columns[0]?.column) continue;
      const columnName = idx.columns[0].column;
      if (idx.where) {
        const predicate = String(idx.where);
        const isNotNullOnly = new RegExp(`\\b${columnName}\\b\\s+is\\s+not\\s+null\\b`, 'i').test(predicate);
        if (!isNotNullOnly) continue;
      }
      uniqueCols.add(columnName);
    }
    uniqueSingleColumns.set(table.name, uniqueCols);
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

      // Skip generating HasMany/HasOne relations TO pivot tables
      // (pivot data is accessible via _pivot on BelongsToMany)
      if (pivotTables.has(table.name)) continue;

      const uniqueCols = uniqueSingleColumns.get(table.name);
      const isHasOne = Boolean(uniqueCols?.has(fk.name));
      const relationKind = isHasOne ? 'hasOne' : 'hasMany';
      const inverseProp = isHasOne ? naming.hasOneProperty(table.name) : naming.hasManyProperty(table.name);
      if (!hasManyKey.has(inverseProp)) {
        hasManyKey.add(inverseProp);
        relationMap.get(targetKey)?.push({
          kind: relationKind,
          property: inverseProp,
          target: table.name,
          foreignKey: fk.name
        });
      }
    }
  }

  return relationMap;
};

export const buildSchemaMetadata = (schema, naming) => {
  const tables = schema.tables.map(t => {
    const indexes = Array.isArray(t.indexes) ? t.indexes.map(idx => ({ ...idx })) : [];
    const uniqueSingleColumns = new Set(
      indexes
        .filter(idx => idx?.unique && !idx?.where && Array.isArray(idx.columns) && idx.columns.length === 1)
        .map(idx => idx.columns[0]?.column)
        .filter(Boolean)
    );

    return {
      name: t.name,
      schema: t.schema,
      columns: (t.columns || []).map(col => {
        const unique = col.unique !== undefined ? col.unique : uniqueSingleColumns.has(col.name) ? true : undefined;
        return { ...col, unique };
      }),
      primaryKey: t.primaryKey || [],
      indexes
    };
  });

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
