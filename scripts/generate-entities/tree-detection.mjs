/**
 * Tree Detection for Entity Generation
 * 
 * Detects if a table is a tree table based on column patterns and relationships.
 * A tree table typically has:
 * - Parent column (nullable self-referencing foreign key)
 * - Left boundary column (integer)
 * - Right boundary column (integer)
 * - Optional depth column (integer)
 * - Optional scope columns for multi-tree tables
 */

/**
 * Detects if a table is a tree table based on column patterns.
 * @param {Object} table - The table schema
 * @param {Object} naming - Naming strategy instance
 * @returns {Object|null} Tree configuration if detected, null otherwise
 */
export const detectTreeTable = (table, naming) => {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const getColumnName = column =>
    column && typeof column.name === 'string' && column.name.trim().length > 0 ? column.name : undefined;
  
  // Common patterns for tree columns
  const parentPatterns = ['parentId', 'parent_id', 'parent'];
  const leftPatterns = ['lft', 'left', 'leftValue', 'left_value'];
  const rightPatterns = ['rght', 'right', 'rightValue', 'right_value'];
  const depthPatterns = ['depth', 'level', 'treeLevel', 'tree_level', 'cod_nivel'];

  const matchesTreePattern = (column, patterns, term) => {
    const name = getColumnName(column);
    if (!name) return false;
    return patterns.includes(name) || name.toLowerCase().includes(term);
  };
  
  // Find matching columns
  const parentCol = columns.find(c => matchesTreePattern(c, parentPatterns, 'parent'));
  
  const leftCol = columns.find(c => matchesTreePattern(c, leftPatterns, 'left'));
  
  const rightCol = columns.find(c => matchesTreePattern(c, rightPatterns, 'right'));
  
  const depthCol = columns.find(c => {
    const name = getColumnName(c);
    if (!name) return false;
    return (
      depthPatterns.includes(name) ||
      name.toLowerCase().includes('depth') ||
      name.toLowerCase().includes('level') ||
      name.toLowerCase().includes('nivel')
    );
  });
  
  // Validate: must have parent, left, and right columns
  if (!parentCol || !leftCol || !rightCol) {
    return null;
  }
  
  // Validate: parent should be nullable and reference the same table
  const isSelfReferencing = parentCol.references?.table === table.name || 
                            parentCol.references?.table === `dbo.${table.name}` ||
                            parentCol.references?.table === `[dbo].[${table.name}]`;
  const isNullable = !parentCol.notNull;
  
  if (!isSelfReferencing || !isNullable) {
    return null;
  }
  
  // Validate: left and right should be integer types
  const leftType = (leftCol.type || '').toLowerCase();
  const rightType = (rightCol.type || '').toLowerCase();
  const isLeftInt = leftType.includes('int');
  const isRightInt = rightType.includes('int');
  
  if (!isLeftInt || !isRightInt) {
    return null;
  }
  
  // Build tree configuration
  const config = {
    parentKey: parentCol.name,
    leftKey: leftCol.name,
    rightKey: rightCol.name,
  };
  
  // Add depth column if found
  if (depthCol) {
    config.depthKey = depthCol.name;
  }
  
  // Detect scope columns (columns that might be used for multi-tree scoping)
  const scopeColumns = columns.filter(c => {
    const name = getColumnName(c);
    if (!name) {
      return false;
    }
    // Skip tree columns and primary key
    if (name === config.parentKey || name === config.leftKey || 
        name === config.rightKey || name === config.depthKey) {
      return false;
    }
    // Skip if it's the primary key
    if (table.primaryKey?.includes(name)) {
      return false;
    }
    // Skip if it has a foreign key to another table
    if (c.references && c.references.table !== table.name) {
      return false;
    }
    // Look for columns that might be scope columns (e.g., tenantId, organizationId)
    const scopePatterns = ['tenant', 'organization', 'company', 'site', 'workspace'];
    return scopePatterns.some(pattern => name.toLowerCase().includes(pattern));
  }).map(c => getColumnName(c)).filter(Boolean);
  
  if (scopeColumns.length > 0) {
    config.scope = scopeColumns;
  }
  
  return config;
};

/**
 * Maps all tree tables in the schema.
 * @param {Array} tables - Array of table schemas
 * @param {Object} naming - Naming strategy instance
 * @returns {Map} Map of table name to tree configuration
 */
export const mapTreeTables = (tables, naming) => {
  const treeMap = new Map();
  
  for (const table of Array.isArray(tables) ? tables : []) {
    const treeConfig = detectTreeTable(table, naming);
    if (treeConfig && table && typeof table.name === 'string' && table.name.trim().length > 0) {
      treeMap.set(table.name, treeConfig);
    }
  }
  
  return treeMap;
};

/**
 * Gets tree configuration for a specific table.
 * @param {string} tableName - The table name
 * @param {Map} treeMap - The tree configuration map
 * @returns {Object|null} Tree configuration if the table is a tree, null otherwise
 */
export const getTreeConfig = (tableName, treeMap) => {
  return treeMap.get(tableName) || null;
};

/**
 * Checks if a table is a tree table.
 * @param {string} tableName - The table name
 * @param {Map} treeMap - The tree configuration map
 * @returns {boolean} True if the table is a tree table
 */
export const isTreeTable = (tableName, treeMap) => {
  return treeMap.has(tableName);
};
