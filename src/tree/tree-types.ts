/**
 * Tree Behavior Types
 * 
 * Core type definitions for the Nested Set (MPTT) tree implementation.
 * These types support hierarchical data structures in relational databases.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';

/**
 * Configuration options for tree behavior.
 */
export interface TreeConfig {
  /** Column name for parent reference (default: 'parentId') */
  parentKey: string;
  /** Column name for left boundary (default: 'lft') */
  leftKey: string;
  /** Column name for right boundary (default: 'rght') */
  rightKey: string;
  /** Optional column name for cached depth level */
  depthKey?: string;
  /** Columns used for scoping multiple trees in one table (e.g., ['tenantId']) */
  scope?: string[];
  /** Whether to load and delete children individually to trigger hooks (default: false) */
  cascadeCallbacks?: boolean;
  /** Custom ordering for tree recovery (default: primary key ASC) */
  recoverOrder?: Record<string, 'ASC' | 'DESC'>;
}

/**
 * Default tree configuration values.
 */
export const DEFAULT_TREE_CONFIG: Readonly<Required<Omit<TreeConfig, 'depthKey' | 'scope' | 'recoverOrder'>>> = {
  parentKey: 'parentId',
  leftKey: 'lft',
  rightKey: 'rght',
  cascadeCallbacks: false,
};

/**
 * Represents a node in the tree with its nested set boundaries.
 * @typeParam T - The entity type
 */
export interface TreeNode<T> {
  /** The underlying entity */
  entity: T;
  /** Left boundary value */
  lft: number;
  /** Right boundary value */
  rght: number;
  /** Depth level (0 = root), if available */
  depth?: number;
  /** Whether this node has no children */
  isLeaf: boolean;
  /** Whether this node has no parent */
  isRoot: boolean;
  /** Number of descendants (calculated from lft/rght) */
  childCount: number;
}

/**
 * Options for finding children/descendants.
 */
export interface FindChildrenOptions {
  /** Only return immediate children (default: false = all descendants) */
  direct?: boolean;
  /** Nest results into a tree structure with .children property */
  threaded?: boolean;
  /** Maximum depth to fetch (undefined = unlimited) */
  depth?: number;
}

/**
 * Options for generating a tree list (for dropdowns/selects).
 */
export interface TreeListOptions {
  /** Dot-separated path to the field used as key (default: primary key) */
  keyPath?: string;
  /** Dot-separated path to the field used as value (default: primary key) */
  valuePath?: string;
  /** Prefix string repeated per depth level (default: '__') */
  spacer?: string;
}

/**
 * Options for finding the path from a node to root.
 */
export interface FindPathOptions {
  /** Include the node itself in the path (default: true) */
  includeSelf?: boolean;
  /** Order of results: 'asc' = root first, 'desc' = node first (default: 'asc') */
  order?: 'asc' | 'desc';
}

/**
 * Options for moving a node within the tree.
 */
export interface MoveOptions {
  /** Position relative to target: 'before', 'after', 'firstChild', 'lastChild' */
  position?: 'before' | 'after' | 'firstChild' | 'lastChild';
}

/**
 * Result of a tree recovery operation.
 */
export interface RecoverResult {
  /** Number of nodes processed */
  processed: number;
  /** Whether the recovery was successful */
  success: boolean;
  /** Any errors encountered */
  errors?: string[];
}

/**
 * Scope values for multi-tree tables.
 */
export type TreeScope = Record<string, unknown>;

/**
 * Internal representation of nested set boundaries for calculations.
 */
export interface NestedSetBounds {
  lft: number;
  rght: number;
}

/**
 * Data required to insert a new node into the tree.
 */
export interface TreeInsertData {
  /** Parent node ID (null for root) */
  parentId: unknown;
  /** Calculated left boundary */
  lft: number;
  /** Calculated right boundary */
  rght: number;
  /** Calculated depth (if depthKey is configured) */
  depth?: number;
}

/**
 * Data required to move a node within the tree.
 */
export interface TreeMoveData {
  /** New parent node ID */
  newParentId: unknown;
  /** New left boundary */
  newLft: number;
  /** New right boundary */
  newRght: number;
  /** New depth (if depthKey is configured) */
  newDepth?: number;
  /** Delta to apply to lft/rght of affected nodes */
  delta: number;
}

/**
 * Represents a node with its children in a threaded tree structure.
 * @typeParam T - The entity type
 */
export interface ThreadedNode<T> {
  /** The node data */
  node: T;
  /** Child nodes */
  children: ThreadedNode<T>[];
}

/**
 * A tree list entry for dropdown/select rendering.
 */
export interface TreeListEntry<K = unknown, V = string> {
  /** The key (usually primary key) */
  key: K;
  /** The display value with depth prefix */
  value: V;
  /** The depth level */
  depth: number;
}

/**
 * Validates that a table has the required tree columns.
 * @param table - The table definition to validate
 * @param config - The tree configuration
 * @returns Validation result with any missing columns
 */
export interface TreeValidationResult {
  valid: boolean;
  missingColumns: string[];
  warnings: string[];
}

/**
 * Extracts tree column definitions from a table.
 */
export interface TreeColumns {
  parentColumn: ColumnDef;
  leftColumn: ColumnDef;
  rightColumn: ColumnDef;
  depthColumn?: ColumnDef;
  scopeColumns: ColumnDef[];
}

/**
 * Type guard to check if a value is a valid TreeConfig.
 */
export function isTreeConfig(value: unknown): value is TreeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.parentKey === 'string' &&
    typeof obj.leftKey === 'string' &&
    typeof obj.rightKey === 'string'
  );
}

/**
 * Merges partial config with defaults.
 */
export function resolveTreeConfig(partial: Partial<TreeConfig>): TreeConfig {
  return {
    parentKey: partial.parentKey ?? DEFAULT_TREE_CONFIG.parentKey,
    leftKey: partial.leftKey ?? DEFAULT_TREE_CONFIG.leftKey,
    rightKey: partial.rightKey ?? DEFAULT_TREE_CONFIG.rightKey,
    depthKey: partial.depthKey,
    scope: partial.scope,
    cascadeCallbacks: partial.cascadeCallbacks ?? DEFAULT_TREE_CONFIG.cascadeCallbacks,
    recoverOrder: partial.recoverOrder,
  };
}

/**
 * Validates that a table definition contains the required tree columns.
 */
export function validateTreeTable(table: TableDef, config: TreeConfig): TreeValidationResult {
  const missingColumns: string[] = [];
  const warnings: string[] = [];

  const requiredColumns = [config.parentKey, config.leftKey, config.rightKey];
  for (const col of requiredColumns) {
    if (!(col in table.columns)) {
      missingColumns.push(col);
    }
  }

  if (config.depthKey && !(config.depthKey in table.columns)) {
    warnings.push(`Optional depth column '${config.depthKey}' not found in table '${table.name}'`);
  }

  if (config.scope) {
    for (const scopeCol of config.scope) {
      if (!(scopeCol in table.columns)) {
        missingColumns.push(scopeCol);
      }
    }
  }

  const leftCol = table.columns[config.leftKey];
  const rightCol = table.columns[config.rightKey];
  if (leftCol && leftCol.type !== 'int' && leftCol.type !== 'integer') {
    warnings.push(`Left column '${config.leftKey}' should be an integer type`);
  }
  if (rightCol && rightCol.type !== 'int' && rightCol.type !== 'integer') {
    warnings.push(`Right column '${config.rightKey}' should be an integer type`);
  }

  return {
    valid: missingColumns.length === 0,
    missingColumns,
    warnings,
  };
}

/**
 * Extracts tree-related columns from a table definition.
 */
export function getTreeColumns(table: TableDef, config: TreeConfig): TreeColumns {
  const parentColumn = table.columns[config.parentKey];
  const leftColumn = table.columns[config.leftKey];
  const rightColumn = table.columns[config.rightKey];
  const depthColumn = config.depthKey ? table.columns[config.depthKey] : undefined;
  const scopeColumns = (config.scope ?? []).map(s => table.columns[s]).filter(Boolean);

  if (!parentColumn || !leftColumn || !rightColumn) {
    throw new Error(
      `Table '${table.name}' is missing required tree columns. ` +
      `Required: ${config.parentKey}, ${config.leftKey}, ${config.rightKey}`
    );
  }

  return {
    parentColumn,
    leftColumn,
    rightColumn,
    depthColumn,
    scopeColumns,
  };
}
