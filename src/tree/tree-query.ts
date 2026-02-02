/**
 * Tree Query Builder
 * 
 * Level 1 API: Pure query builders for tree operations.
 * Returns SelectQueryBuilder instances that can be compiled to any dialect.
 */

import { SelectQueryBuilder } from '../query-builder/select.js';
import { selectFrom } from '../query/index.js';
import { and, eq, gt, gte, lt, lte, isNull, neq, sub } from '../core/ast/expression.js';
import type { TableDef } from '../schema/table.js';
import type {
  TreeConfig,
  FindPathOptions,
  TreeListOptions,
  TreeScope,
  ThreadedNode,
  NestedSetBounds,
} from './tree-types.js';
import {
  resolveTreeConfig,
  getTreeColumns,
  validateTreeTable,
} from './tree-types.js';
import {
  NestedSetStrategy,
  buildScopeConditions,
} from './nested-set-strategy.js';

/**
 * Tree query helper bound to a specific table and configuration.
 * @typeParam T - The table definition type
 */
export interface TreeQuery<T extends TableDef> {
  /** The underlying table definition */
  readonly table: T;
  /** The resolved tree configuration */
  readonly config: TreeConfig;

  /**
   * Finds ancestors of a node given its bounds.
   * Returns ancestors ordered from root to node (or reverse if order: 'desc').
   * 
   * @param bounds - The lft/rght values of the target node
   * @param options - Path options
   */
  findAncestors(
    bounds: NestedSetBounds,
    options?: FindPathOptions
  ): SelectQueryBuilder<unknown, T>;

  /**
   * Finds all descendants of a node given its bounds.
   * 
   * @param bounds - The lft/rght values of the parent node
   */
  findDescendants(bounds: NestedSetBounds): SelectQueryBuilder<unknown, T>;

  /**
   * Finds direct children of a node by parent ID.
   */
  findDirectChildren(parentId: unknown): SelectQueryBuilder<unknown, T>;

  /**
   * Finds the parent of a node by parent ID reference.
   */
  findParentById(parentId: unknown): SelectQueryBuilder<unknown, T>;

  /**
   * Finds all siblings of a node by parent ID.
   */
  findSiblings(
    parentId: unknown,
    excludeId?: unknown
  ): SelectQueryBuilder<unknown, T>;

  /**
   * Finds all root nodes (nodes with no parent).
   */
  findRoots(): SelectQueryBuilder<unknown, T>;

  /**
   * Finds all leaf nodes (nodes with no children).
   */
  findLeaves(): SelectQueryBuilder<unknown, T>;

  /**
   * Finds a subtree: the node and all its descendants.
   * 
   * @param bounds - The lft/rght values of the root node
   */
  findSubtree(bounds: NestedSetBounds): SelectQueryBuilder<unknown, T>;

  /**
   * Creates a tree list query for dropdown/select rendering.
   * Returns all nodes ordered by lft.
   */
  findTreeList(options?: TreeListOptions): SelectQueryBuilder<unknown, T>;

  /**
   * Finds nodes at a specific depth level.
   * Requires depthKey to be configured.
   */
  findAtDepth(depth: number): SelectQueryBuilder<unknown, T>;

  /**
   * Finds a node by ID.
   */
  findById(id: unknown): SelectQueryBuilder<unknown, T>;

  /**
   * Sets scope values for multi-tree tables.
   * Returns a new TreeQuery with the scope applied.
   */
  withScope(scope: TreeScope): TreeQuery<T>;
}

/**
 * Internal state for tree query builder.
 */
interface TreeQueryState<T extends TableDef> {
  table: T;
  config: TreeConfig;
  scopeValues: TreeScope;
}

/**
 * Creates a tree query helper for a table.
 * 
 * @example
 * ```ts
 * const tree = treeQuery(categories, {
 *   parentKey: 'parentId',
 *   leftKey: 'lft',
 *   rightKey: 'rght',
 * });
 * 
 * // Find direct children
 * const childrenQuery = tree.findDirectChildren(1);
 * 
 * // Find descendants (requires bounds)
 * const node = await getNode(1); // { lft: 1, rght: 14 }
 * const descendantsQuery = tree.findDescendants({ lft: node.lft, rght: node.rght });
 * ```
 */
export function treeQuery<T extends TableDef>(
  table: T,
  config: Partial<TreeConfig> = {}
): TreeQuery<T> {
  const resolvedConfig = resolveTreeConfig(config);
  const validation = validateTreeTable(table, resolvedConfig);
  
  if (!validation.valid) {
    throw new Error(
      `Invalid tree table '${table.name}': missing columns ${validation.missingColumns.join(', ')}`
    );
  }

  return createTreeQuery({
    table,
    config: resolvedConfig,
    scopeValues: {},
  });
}

function createTreeQuery<T extends TableDef>(state: TreeQueryState<T>): TreeQuery<T> {
  const { table, config, scopeValues } = state;
  const columns = getTreeColumns(table, config);
  const pkName = getPrimaryKeyName(table);

  const applyScope = (qb: SelectQueryBuilder<unknown, T>): SelectQueryBuilder<unknown, T> => {
    const conditions = buildScopeConditions(config.scope, scopeValues);
    let result = qb;
    for (const [key, value] of Object.entries(conditions)) {
      const col = table.columns[key];
      if (col) {
        result = result.where(eq(col, value)) as SelectQueryBuilder<unknown, T>;
      }
    }
    return result;
  };

  const tq: TreeQuery<T> = {
    table,
    config,

    findAncestors(bounds: NestedSetBounds, options: FindPathOptions = {}): SelectQueryBuilder<unknown, T> {
      const { includeSelf = true, order = 'asc' } = options;

      let qb = selectFrom(table) as unknown as SelectQueryBuilder<unknown, T>;

      if (includeSelf) {
        qb = qb.where(
          and(
            lte(columns.leftColumn, bounds.lft),
            gte(columns.rightColumn, bounds.rght)
          )
        ) as SelectQueryBuilder<unknown, T>;
      } else {
        qb = qb.where(
          and(
            lt(columns.leftColumn, bounds.lft),
            gt(columns.rightColumn, bounds.rght)
          )
        ) as SelectQueryBuilder<unknown, T>;
      }

      qb = qb.orderBy(columns.leftColumn, order === 'asc' ? 'ASC' : 'DESC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findDescendants(bounds: NestedSetBounds): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(
          and(
            gt(columns.leftColumn, bounds.lft),
            lt(columns.rightColumn, bounds.rght)
          )
        )
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findDirectChildren(parentId: unknown): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(eq(columns.parentColumn, parentId))
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findParentById(parentId: unknown): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(eq(table.columns[pkName], parentId)) as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findSiblings(parentId: unknown, excludeId?: unknown): SelectQueryBuilder<unknown, T> {
      let qb = selectFrom(table)
        .where(eq(columns.parentColumn, parentId)) as SelectQueryBuilder<unknown, T>;

      if (excludeId !== undefined) {
        qb = qb.where(neq(table.columns[pkName], excludeId)) as SelectQueryBuilder<unknown, T>;
      }

      qb = qb.orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findRoots(): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(isNull(columns.parentColumn))
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findLeaves(): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(eq(sub(columns.rightColumn, columns.leftColumn), 1))
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findSubtree(bounds: NestedSetBounds): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(
          and(
            gte(columns.leftColumn, bounds.lft),
            lte(columns.rightColumn, bounds.rght)
          )
        )
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findTreeList(): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findAtDepth(depth: number): SelectQueryBuilder<unknown, T> {
      if (!config.depthKey) {
        throw new Error('findAtDepth requires depthKey to be configured');
      }

      const qb = selectFrom(table)
        .where(eq(columns.depthColumn!, depth))
        .orderBy(columns.leftColumn, 'ASC') as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    findById(id: unknown): SelectQueryBuilder<unknown, T> {
      const qb = selectFrom(table)
        .where(eq(table.columns[pkName], id)) as SelectQueryBuilder<unknown, T>;

      return applyScope(qb);
    },

    withScope(scope: TreeScope): TreeQuery<T> {
      return createTreeQuery({
        ...state,
        scopeValues: { ...scopeValues, ...scope },
      });
    },
  };

  return tq;
}

/**
 * Gets the primary key column name from a table.
 */
function getPrimaryKeyName(table: TableDef): string {
  for (const [name, col] of Object.entries(table.columns)) {
    if (col.primary) {
      return name;
    }
  }
  if (table.primaryKey && table.primaryKey.length > 0) {
    return table.primaryKey[0];
  }
  return 'id';
}

/**
 * Utility to thread flat query results into a nested structure.
 * Use after executing a query that returns nodes ordered by lft.
 * 
 * @example
 * ```ts
 * const rows = await executor.executeSql(sql, params);
 * const threaded = threadResults(rows, 'lft', 'rght');
 * ```
 */
export function threadResults<T extends Record<string, unknown>>(
  rows: T[],
  leftKey: string = 'lft',
  rightKey: string = 'rght'
): ThreadedNode<T>[] {
  return NestedSetStrategy.toThreaded(
    rows,
    row => row[leftKey] as number,
    row => row[rightKey] as number
  );
}

/**
 * Utility to format query results as a tree list for dropdowns.
 * 
 * @example
 * ```ts
 * const rows = await executor.executeSql(sql, params);
 * const list = formatTreeList(rows, {
 *   keyPath: 'id',
 *   valuePath: 'name',
 *   spacer: '—',
 * });
 * // Returns: [{ key: 1, value: 'Root', depth: 0 }, { key: 2, value: '—Child', depth: 1 }, ...]
 * ```
 */
export function formatTreeList<T extends Record<string, unknown>>(
  rows: T[],
  options: TreeListOptions & { 
    leftKey?: string; 
    rightKey?: string;
    depthKey?: string;
  } = {}
): Array<{ key: unknown; value: string; depth: number }> {
  const {
    keyPath = 'id',
    valuePath = 'id',
    spacer = '__',
    leftKey = 'lft',
    rightKey = 'rght',
    depthKey,
  } = options;

  let depthsCache: Map<T, number> | null = null;

  const getDepth = (row: T): number => {
    if (depthKey && row[depthKey] !== undefined) {
      return row[depthKey] as number;
    }
    if (!depthsCache) {
      depthsCache = NestedSetStrategy.calculateDepths(
        rows,
        r => r[leftKey] as number,
        r => r[rightKey] as number
      );
    }
    return depthsCache.get(row) ?? 0;
  };

  return NestedSetStrategy.toTreeList(
    rows,
    row => row[keyPath],
    row => String(row[valuePath]),
    getDepth,
    spacer
  );
}

/**
 * Calculates and caches depths for a set of rows.
 * Useful when depth is not stored in the database.
 */
export function calculateRowDepths<T extends Record<string, unknown>>(
  rows: T[],
  leftKey: string = 'lft',
  rightKey: string = 'rght'
): Map<T, number> {
  return NestedSetStrategy.calculateDepths(
    rows,
    row => row[leftKey] as number,
    row => row[rightKey] as number
  );
}
