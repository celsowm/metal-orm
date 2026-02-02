/**
 * Tree Manager
 * 
 * Level 2 API: ORM runtime integration for tree operations.
 * Provides session-aware tree manipulation with Unit of Work integration.
 */

import type { OrmSession } from '../orm/orm-session.js';
import type { DbExecutor } from '../core/execution/db-executor.js';
import type { Dialect } from '../core/dialect/abstract.js';
import type { TableDef } from '../schema/table.js';
import { selectFrom, insertInto, update, deleteFrom } from '../query/index.js';
import type { QueryResult } from '../core/execution/db-executor.js';
import { and, eq, gte, lte, ValueOperandInput } from '../core/ast/expression.js';

import type {
  TreeConfig,
  NestedSetBounds,
  RecoverResult,
  TreeScope,
  ThreadedNode,
} from './tree-types.js';
import {
  resolveTreeConfig,
  validateTreeTable,
} from './tree-types.js';
import {
  NestedSetStrategy,
  NodeWithPk,
  buildScopeConditions,
} from './nested-set-strategy.js';
import { treeQuery, TreeQuery, threadResults } from './tree-query.js';

/**
 * Options for creating a TreeManager.
 */
export interface TreeManagerOptions<T extends TableDef> {
  /** Database executor for running queries */
  executor: DbExecutor;
  /** SQL dialect */
  dialect: Dialect;
  /** Table definition */
  table: T;
  /** Tree configuration */
  config?: Partial<TreeConfig>;
  /** Optional scope values for multi-tree tables */
  scope?: TreeScope;
}

/**
 * Result of fetching a node with tree metadata.
 */
export interface TreeNodeResult<T = Record<string, unknown>> {
  /** The node data */
  data: T;
  /** Nested set bounds */
  lft: number;
  rght: number;
  /** Parent ID (null for roots) */
  parentId: unknown;
  /** Depth level (if available) */
  depth?: number;
  /** Whether this is a leaf node */
  isLeaf: boolean;
  /** Whether this is a root node */
  isRoot: boolean;
  /** Count of descendants */
  childCount: number;
}

/**
 * Tree Manager for Level 2 ORM runtime integration.
 * Provides session-aware tree operations with proper change tracking.
 * 
 * @typeParam T - The table definition type
 * 
 * @example
 * ```ts
 * const manager = new TreeManager({
 *   executor: session.executor,
 *   dialect: session.dialect,
 *   table: categories,
 *   config: { parentKey: 'parentId', leftKey: 'lft', rightKey: 'rght' },
 * });
 * 
 * const node = await manager.getNode(5);
 * await manager.moveUp(node);
 * ```
 */
export class TreeManager<T extends TableDef> {
  readonly table: T;
  readonly config: TreeConfig;
  readonly query: TreeQuery<T>;

  private readonly executor: DbExecutor;
  private readonly dialect: Dialect;
  private readonly scopeValues: TreeScope;
  private readonly pkName: string;

  constructor(options: TreeManagerOptions<T>) {
    const { executor, dialect, table, config = {}, scope = {} } = options;

    this.executor = executor;
    this.dialect = dialect;
    this.table = table;
    this.config = resolveTreeConfig(config);
    this.scopeValues = scope;
    this.pkName = this.getPrimaryKeyName();

    const validation = validateTreeTable(table, this.config);
    if (!validation.valid) {
      throw new Error(
        `Invalid tree table '${table.name}': missing columns ${validation.missingColumns.join(', ')}`
      );
    }

    this.query = treeQuery(table, this.config).withScope(scope);
  }

  /**
   * Gets a node by ID with tree metadata.
   */
  async getNode(id: unknown): Promise<TreeNodeResult | null> {
    const query = this.query.findById(id);
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    if (rows.length === 0) return null;

    return this.createNodeResult(rows[0]);
  }

  /**
   * Gets the root nodes.
   */
  async getRoots(): Promise<TreeNodeResult[]> {
    const query = this.query.findRoots();
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    return rows.map(row => this.createNodeResult(row));
  }

  /**
   * Gets direct children of a node.
   */
  async getChildren(parentId: unknown): Promise<TreeNodeResult[]> {
    const query = this.query.findDirectChildren(parentId);
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    return rows.map(row => this.createNodeResult(row));
  }

  /**
   * Gets all descendants of a node.
   */
  async getDescendants(node: TreeNodeResult | NestedSetBounds): Promise<TreeNodeResult[]> {
    const bounds = this.getBounds(node);
    const query = this.query.findDescendants(bounds);
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    return rows.map(row => this.createNodeResult(row));
  }

  /**
   * Gets the path from root to a node (ancestors).
   */
  async getPath(node: TreeNodeResult | NestedSetBounds, includeSelf: boolean = true): Promise<TreeNodeResult[]> {
    const bounds = this.getBounds(node);
    const query = this.query.findAncestors(bounds, { includeSelf });
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    return rows.map(row => this.createNodeResult(row));
  }

  /**
   * Gets siblings of a node.
   */
  async getSiblings(node: TreeNodeResult, includeSelf: boolean = false): Promise<TreeNodeResult[]> {
    const query = this.query.findSiblings(
      node.parentId,
      includeSelf ? undefined : (node.data as Record<string, unknown>)[this.pkName]
    );
    const { sql, params } = query.compile(this.dialect);
    const results = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(results);

    return rows.map(row => this.createNodeResult(row));
  }

  /**
   * Gets the parent of a node.
   */
  async getParent(node: TreeNodeResult): Promise<TreeNodeResult | null> {
    if (node.isRoot) return null;
    return this.getNode(node.parentId);
  }

  /**
   * Gets all descendants as a threaded (nested) structure.
   */
  async getDescendantsThreaded(node: TreeNodeResult | NestedSetBounds): Promise<ThreadedNode<Record<string, unknown>>[]> {
    const bounds = this.getBounds(node);
    const query = this.query.findSubtree(bounds);
    const { sql, params } = query.compile(this.dialect);
    const queryResults = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(queryResults);

    return threadResults(
      rows,
      this.config.leftKey,
      this.config.rightKey
    );
  }

  /**
   * Counts descendants of a node.
   */
  childCount(node: TreeNodeResult | NestedSetBounds): number {
    const bounds = this.getBounds(node);
    return NestedSetStrategy.childCount(bounds.lft, bounds.rght);
  }

  /**
   * Gets the depth (level) of a node.
   */
  async getLevel(node: TreeNodeResult | NestedSetBounds): Promise<number> {
    const bounds = this.getBounds(node);
    
    if ('depth' in node && typeof node.depth === 'number') {
      return node.depth;
    }

    const ancestors = await this.getPath(bounds, false);
    return ancestors.length;
  }

  /**
   * Moves a node up among its siblings.
   * @returns true if moved, false if already at top
   */
  async moveUp(node: TreeNodeResult): Promise<boolean> {
    const siblings = await this.getSiblings(node, true);
    const nodeIndex = siblings.findIndex(
      s => (s.data as Record<string, unknown>)[this.pkName] === (node.data as Record<string, unknown>)[this.pkName]
    );

    if (nodeIndex <= 0) return false;

    const prevSibling = siblings[nodeIndex - 1];
    return this.swapNodes(node, prevSibling);
  }

  /**
   * Moves a node down among its siblings.
   * @returns true if moved, false if already at bottom
   */
  async moveDown(node: TreeNodeResult): Promise<boolean> {
    const siblings = await this.getSiblings(node, true);
    const nodeIndex = siblings.findIndex(
      s => (s.data as Record<string, unknown>)[this.pkName] === (node.data as Record<string, unknown>)[this.pkName]
    );

    if (nodeIndex < 0 || nodeIndex >= siblings.length - 1) return false;

    const nextSibling = siblings[nodeIndex + 1];
    return this.swapNodes(node, nextSibling);
  }

  /**
   * Moves a node to be the last child of a new parent.
   */
  async moveTo(node: TreeNodeResult, newParentId: unknown | null): Promise<void> {
    NestedSetStrategy.subtreeWidth(node.lft, node.rght);

    let newPos: { lft: number; rght: number; depth: number };

    if (newParentId === null) {
      const maxRght = await this.getMaxRght();
      newPos = NestedSetStrategy.calculateInsertAsRoot(maxRght);
    } else {
      const newParent = await this.getNode(newParentId);
      if (!newParent) {
        throw new Error(`Parent node ${newParentId} not found`);
      }
      newPos = NestedSetStrategy.calculateInsertAsLastChild(
        newParent.rght,
        newParent.depth ?? await this.getLevel(newParent)
      );
    }

    await this.moveSubtree(node, newPos.lft, newParentId, newPos.depth);
  }

  /**
   * Inserts a new node as a child of a parent.
   * @returns The ID of the new node (if auto-generated)
   */
  async insertAsChild(
    parentId: unknown | null,
    data: Record<string, unknown>
  ): Promise<unknown> {
    let insertPos: { lft: number; rght: number; depth: number };

    if (parentId === null) {
      const maxRght = await this.getMaxRght();
      insertPos = NestedSetStrategy.calculateInsertAsRoot(maxRght);
    } else {
      const parent = await this.getNode(parentId);
      if (!parent) {
        throw new Error(`Parent node ${parentId} not found`);
      }

      await this.shiftForInsert(parent.rght);

      insertPos = NestedSetStrategy.calculateInsertAsLastChild(
        parent.rght,
        parent.depth ?? await this.getLevel(parent)
      );
    }

    const insertData = {
      ...data,
      [this.config.parentKey]: parentId,
      [this.config.leftKey]: insertPos.lft,
      [this.config.rightKey]: insertPos.rght,
    };

    if (this.config.depthKey) {
      insertData[this.config.depthKey] = insertPos.depth;
    }

    const scopeData = buildScopeConditions(this.config.scope, this.scopeValues);
    Object.assign(insertData, scopeData);

    const insertQuery = insertInto(this.table).values(insertData as Record<string, ValueOperandInput>);
    const { sql, params } = insertQuery.compile(this.dialect);
    await this.executor.executeSql(sql, params);

    return insertData[this.pkName];
  }

  /**
   * Removes a node and re-parents its children to the node's parent.
   */
  async removeFromTree(node: TreeNodeResult): Promise<void> {
    const nodeId = (node.data as Record<string, unknown>)[this.pkName];

    await this.executeUpdate(
      eq(this.table.columns[this.config.parentKey], nodeId),
      { [this.config.parentKey]: node.parentId }
    );

    const gap = NestedSetStrategy.calculateDeleteGap(node.lft, node.rght);
    await this.shiftForDelete(node.rght, 2);

    NestedSetStrategy.calculateShiftForDelete(node.lft + 1, gap.width - 2);
    if (gap.width > 2) {
      await this.executeRawUpdate(
        `UPDATE ${this.quoteTable()} SET ` +
        `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} - 1, ` +
        `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} - 1 ` +
        `WHERE ${this.quoteCol(this.config.leftKey)} > ? AND ${this.quoteCol(this.config.rightKey)} < ?`,
        [node.lft, node.rght]
      );
    }
  }

  /**
   * Deletes a node and all its descendants.
   */
  async deleteSubtree(node: TreeNodeResult): Promise<number> {
    const bounds = { lft: node.lft, rght: node.rght };
    const width = NestedSetStrategy.subtreeWidth(bounds.lft, bounds.rght);

    const deleteQuery = deleteFrom(this.table)
      .where(
        and(
          gte(this.table.columns[this.config.leftKey], bounds.lft),
          lte(this.table.columns[this.config.rightKey], bounds.rght)
        )
      );

    const scopeConditions = buildScopeConditions(this.config.scope, this.scopeValues);
    let finalQuery = deleteQuery;
    for (const [key, value] of Object.entries(scopeConditions)) {
      finalQuery = finalQuery.where(eq(this.table.columns[key], value));
    }

    const { sql, params } = finalQuery.compile(this.dialect);
    await this.executor.executeSql(sql, params);

    await this.shiftForDelete(bounds.rght, width);

    return width / 2;
  }

  /**
   * Rebuilds the tree structure from parent_id relationships.
   * Useful for fixing corrupted trees or initial population.
   */
  async recover(): Promise<RecoverResult> {
    try {
      const nodes = await this.getAllNodesForRecovery();
      const updates = NestedSetStrategy.recover(nodes, (a, b) => {
        if (this.config.recoverOrder) {
          const [key, dir] = Object.entries(this.config.recoverOrder)[0];
          const aVal = a[key as keyof typeof a];
          const bVal = b[key as keyof typeof b];
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return dir === 'DESC' ? -cmp : cmp;
        }
        return (a.pk as number) - (b.pk as number);
      });

      for (const update of updates) {
        const updateData: Record<string, unknown> = {
          [this.config.leftKey]: update.lft,
          [this.config.rightKey]: update.rght,
        };
        if (this.config.depthKey) {
          updateData[this.config.depthKey] = update.depth;
        }

        await this.executeUpdate(
          eq(this.table.columns[this.pkName], update.pk),
          updateData
        );
      }

      return { processed: updates.length, success: true };
    } catch (error) {
      return {
        processed: 0,
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Validates the tree structure.
   * @returns Array of validation errors (empty if valid)
   */
  async validate(): Promise<string[]> {
    const query = this.query.findTreeList();
    const { sql, params } = query.compile(this.dialect);
    const queryResults = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(queryResults);

    return NestedSetStrategy.validateTree(
      rows,
      row => row[this.config.leftKey] as number,
      row => row[this.config.rightKey] as number,
      row => row[this.pkName]
    );
  }

  /**
   * Creates a new TreeManager with different scope values.
   */
  withScope(scope: TreeScope): TreeManager<T> {
    return new TreeManager({
      executor: this.executor,
      dialect: this.dialect,
      table: this.table,
      config: this.config,
      scope: { ...this.scopeValues, ...scope },
    });
  }

  // ===== Private Helpers =====

  private createNodeResult(row: Record<string, unknown>): TreeNodeResult {
    const lft = row[this.config.leftKey] as number;
    const rght = row[this.config.rightKey] as number;
    const parentId = row[this.config.parentKey];
    const depth = this.config.depthKey ? row[this.config.depthKey] as number | undefined : undefined;

    return {
      data: row,
      lft,
      rght,
      parentId,
      depth,
      isLeaf: NestedSetStrategy.isLeaf(lft, rght),
      isRoot: NestedSetStrategy.isRoot(parentId),
      childCount: NestedSetStrategy.childCount(lft, rght),
    };
  }

  private getBounds(node: TreeNodeResult | NestedSetBounds): NestedSetBounds {
    if ('data' in node) {
      return { lft: node.lft, rght: node.rght };
    }
    return node;
  }

  private getPrimaryKeyName(): string {
    for (const [name, col] of Object.entries(this.table.columns)) {
      if (col.primary) {
        return name;
      }
    }
    if (this.table.primaryKey && this.table.primaryKey.length > 0) {
      return this.table.primaryKey[0];
    }
    return 'id';
  }

  private async getMaxRght(): Promise<number> {
    const query = selectFrom(this.table)
      .selectRaw(`MAX(${this.config.rightKey}) as max_rght`);
    const { sql, params } = query.compile(this.dialect);
    const queryResults = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(queryResults);

    const maxRght = rows[0]?.max_rght;
    return typeof maxRght === 'number' ? maxRght : 0;
  }

  private async shiftForInsert(insertPoint: number): Promise<void> {
    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} + 2 ` +
      `WHERE ${this.quoteCol(this.config.rightKey)} >= ?`,
      [insertPoint]
    );

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} + 2 ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} > ?`,
      [insertPoint]
    );
  }

  private async shiftForDelete(deletedRght: number, width: number): Promise<void> {
    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} - ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} > ?`,
      [width, deletedRght]
    );

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} - ? ` +
      `WHERE ${this.quoteCol(this.config.rightKey)} > ?`,
      [width, deletedRght]
    );
  }

  private async swapNodes(nodeA: TreeNodeResult, nodeB: TreeNodeResult): Promise<boolean> {
    const shift = NestedSetStrategy.calculateMoveUp(
      { lft: nodeA.lft, rght: nodeA.rght },
      { lft: nodeB.lft, rght: nodeB.rght }
    );

    if (!shift) return false;

    const tempOffset = 10000000;

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} + ?, ` +
      `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} + ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} >= ? AND ${this.quoteCol(this.config.rightKey)} <= ?`,
      [tempOffset, tempOffset, nodeA.lft, nodeA.rght]
    );

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} + ?, ` +
      `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} + ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} >= ? AND ${this.quoteCol(this.config.rightKey)} <= ?`,
      [shift.siblingShift, shift.siblingShift, nodeB.lft, nodeB.rght]
    );

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} - ? + ?, ` +
      `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} - ? + ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} >= ?`,
      [tempOffset, shift.nodeShift, tempOffset, shift.nodeShift, nodeA.lft + tempOffset]
    );

    return true;
  }

  private async moveSubtree(
    node: TreeNodeResult,
    newLft: number,
    newParentId: unknown | null,
    newDepth: number
  ): Promise<void> {
    const width = NestedSetStrategy.subtreeWidth(node.lft, node.rght);
    const delta = newLft - node.lft;
    const depthDelta = this.config.depthKey
      ? newDepth - (node.depth ?? 0)
      : 0;
    const nodeId = (node.data as Record<string, unknown>)[this.pkName];

    const tempOffset = 10000000;

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} + ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} >= ? AND ${this.quoteCol(this.config.rightKey)} <= ?`,
      [tempOffset, node.lft, node.rght]
    );

    await this.executeRawUpdate(
      `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} + ? ` +
      `WHERE ${this.quoteCol(this.config.leftKey)} >= ? AND ${this.quoteCol(this.config.rightKey)} <= ?`,
      [tempOffset, node.lft + tempOffset, node.rght]
    );

    await this.shiftForDelete(node.rght, width);
    await this.shiftForInsert(newLft);

    let updateSql = `UPDATE ${this.quoteTable()} SET ` +
      `${this.quoteCol(this.config.leftKey)} = ${this.quoteCol(this.config.leftKey)} - ? + ?, ` +
      `${this.quoteCol(this.config.rightKey)} = ${this.quoteCol(this.config.rightKey)} - ? + ?`;
    
    const updateParams: unknown[] = [tempOffset, delta, tempOffset, delta];

    if (this.config.depthKey && depthDelta !== 0) {
      updateSql += `, ${this.quoteCol(this.config.depthKey)} = ${this.quoteCol(this.config.depthKey)} + ?`;
      updateParams.push(depthDelta);
    }

    updateSql += ` WHERE ${this.quoteCol(this.config.leftKey)} >= ?`;
    updateParams.push(node.lft + tempOffset);

    await this.executeRawUpdate(updateSql, updateParams);

    await this.executeUpdate(
      eq(this.table.columns[this.pkName], nodeId),
      { [this.config.parentKey]: newParentId }
    );
  }

  private async getAllNodesForRecovery(): Promise<NodeWithPk<unknown>[]> {
    const query = selectFrom(this.table)
      .select(this.pkName, this.config.parentKey, this.config.leftKey, this.config.rightKey);

    const scopeConditions = buildScopeConditions(this.config.scope, this.scopeValues);
    let finalQuery = query;
    for (const [key, value] of Object.entries(scopeConditions)) {
      finalQuery = finalQuery.where(eq(this.table.columns[key], value));
    }

    const { sql, params } = finalQuery.compile(this.dialect);
    const queryResults = await this.executor.executeSql(sql, params);
    const rows = queryResultsToRows(queryResults);

    return rows.map(row => ({
      pk: row[this.pkName],
      lft: row[this.config.leftKey] as number,
      rght: row[this.config.rightKey] as number,
      parentId: row[this.config.parentKey],
    }));
  }

  private async executeUpdate(
    condition: ReturnType<typeof eq>,
    data: Record<string, unknown>
  ): Promise<void> {
    const query = update(this.table).set(data).where(condition);
    const { sql, params } = query.compile(this.dialect);
    await this.executor.executeSql(sql, params);
  }

  private async executeRawUpdate(sql: string, params: unknown[]): Promise<void> {
    await this.executor.executeSql(sql, params);
  }

  private quoteTable(): string {
    const quote = this.getQuoteChar();
    return `${quote}${this.table.name}${quote}`;
  }

  private quoteCol(name: string): string {
    const quote = this.getQuoteChar();
    return `${quote}${name}${quote}`;
  }

  private getQuoteChar(): string {
    const dialectName = this.dialect.constructor.name.toLowerCase();
    return dialectName.includes('mysql') ? '`' : '"';
  }
}

/**
 * Creates a TreeManager from an OrmSession.
 * Convenience factory for Level 2 integration.
 */
export function createTreeManager<T extends TableDef>(
  session: OrmSession,
  table: T,
  config?: Partial<TreeConfig>,
  scope?: TreeScope
): TreeManager<T> {
  return new TreeManager({
    executor: session.executor,
    dialect: session.dialect,
    table,
    config,
    scope,
  });
}

/**
 * Converts QueryResult[] to row objects.
 * Handles the canonical { columns, values } format.
 */
function queryResultsToRows(results: QueryResult[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  
  for (const result of results) {
    const { columns, values } = result;
    for (const valueRow of values) {
      const row: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = valueRow[i];
      }
      rows.push(row);
    }
  }
  
  return rows;
}
