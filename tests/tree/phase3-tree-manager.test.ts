import { describe, expect, it, vi, beforeEach } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import type { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import { rowsToQueryResult } from '../../src/core/execution/db-executor.js';
import { TreeManager, createTreeManager } from '../../src/tree/tree-manager.js';
import { NestedSetStrategy } from '../../src/tree/nested-set-strategy.js';
import type { OrmSession } from '../../src/orm/orm-session.js';

const createCategoriesTable = () =>
  defineTable('categories', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    parentId: col.int(),
    lft: col.int(),
    rght: col.int(),
    depth: col.int(),
  });

type RowData = Record<string, unknown>[];

const toQueryResults = (rows: RowData): QueryResult[] => {
  if (rows.length === 0) return [];
  return [rowsToQueryResult(rows)];
};

const createMockExecutor = (responses: RowData[] = []): {
  executor: DbExecutor;
  executed: Array<{ sql: string; params?: unknown[] }>;
} => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];
  let callIndex = 0;

  const executor: DbExecutor = {
    capabilities: { transactions: true },
    async executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]> {
      executed.push({ sql, params });
      const rowData = responses[callIndex] ?? [];
      callIndex += 1;
      return toQueryResults(rowData);
    },
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    dispose: vi.fn(),
  };

  return { executor, executed };
};

describe('TreeManager', () => {
  const dialect = new SqliteDialect();

  describe('creation', () => {
    it('creates a manager with default config', () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor();

      const manager = new TreeManager({
        executor,
        dialect,
        table,
      });

      expect(manager.table).toBe(table);
      expect(manager.config.parentKey).toBe('parentId');
      expect(manager.config.leftKey).toBe('lft');
      expect(manager.config.rightKey).toBe('rght');
    });

    it('creates a manager with custom config', () => {
      const table = defineTable('custom', {
        id: col.primaryKey(col.int()),
        ancestor_id: col.int(),
        tree_left: col.int(),
        tree_right: col.int(),
      });
      const { executor } = createMockExecutor();

      const manager = new TreeManager({
        executor,
        dialect,
        table,
        config: {
          parentKey: 'ancestor_id',
          leftKey: 'tree_left',
          rightKey: 'tree_right',
        },
      });

      expect(manager.config.parentKey).toBe('ancestor_id');
      expect(manager.config.leftKey).toBe('tree_left');
      expect(manager.config.rightKey).toBe('tree_right');
    });

    it('throws for missing required columns', () => {
      const table = defineTable('incomplete', {
        id: col.primaryKey(col.int()),
        parentId: col.int(),
      });
      const { executor } = createMockExecutor();

      expect(() => new TreeManager({ executor, dialect, table })).toThrow('missing columns');
    });
  });

  describe('getNode', () => {
    it('returns null for non-existent node', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([[]]);

      const manager = new TreeManager({ executor, dialect, table });
      const result = await manager.getNode(999);

      expect(result).toBeNull();
    });

    it('returns node with tree metadata', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [{ id: 1, name: 'Root', parentId: null, lft: 1, rght: 14, depth: 0 }],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const result = await manager.getNode(1);

      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ id: 1, name: 'Root', parentId: null, lft: 1, rght: 14, depth: 0 });
      expect(result!.lft).toBe(1);
      expect(result!.rght).toBe(14);
      expect(result!.isRoot).toBe(true);
      expect(result!.isLeaf).toBe(false);
      expect(result!.childCount).toBe(6);
    });

    it('correctly identifies leaf nodes', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [{ id: 5, name: 'Leaf', parentId: 2, lft: 3, rght: 4, depth: 2 }],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const result = await manager.getNode(5);

      expect(result!.isLeaf).toBe(true);
      expect(result!.isRoot).toBe(false);
      expect(result!.childCount).toBe(0);
    });
  });

  describe('getRoots', () => {
    it('returns all root nodes', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 1, name: 'Root1', parentId: null, lft: 1, rght: 6 },
          { id: 2, name: 'Root2', parentId: null, lft: 7, rght: 12 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const roots = await manager.getRoots();

      expect(roots).toHaveLength(2);
      expect(roots[0].data).toMatchObject({ name: 'Root1' });
      expect(roots[1].data).toMatchObject({ name: 'Root2' });
      expect(executed[0].sql).toContain('"parentId" IS NULL');
    });
  });

  describe('getChildren', () => {
    it('returns direct children by parent ID', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 2, name: 'Child1', parentId: 1, lft: 2, rght: 5 },
          { id: 3, name: 'Child2', parentId: 1, lft: 6, rght: 7 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const children = await manager.getChildren(1);

      expect(children).toHaveLength(2);
      expect(executed[0].sql).toContain('"parentId" = ?');
      expect(executed[0].params).toContain(1);
    });
  });

  describe('getDescendants', () => {
    it('returns all descendants using bounds', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 2, name: 'Child1', parentId: 1, lft: 2, rght: 5 },
          { id: 4, name: 'Grandchild', parentId: 2, lft: 3, rght: 4 },
          { id: 3, name: 'Child2', parentId: 1, lft: 6, rght: 7 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const descendants = await manager.getDescendants({ lft: 1, rght: 8 });

      expect(descendants).toHaveLength(3);
      expect(executed[0].sql).toContain('"lft" > ?');
      expect(executed[0].sql).toContain('"rght" < ?');
    });
  });

  describe('getPath', () => {
    it('returns ancestors from root to node', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 1, name: 'Root', parentId: null, lft: 1, rght: 14 },
          { id: 2, name: 'Child', parentId: 1, lft: 2, rght: 9 },
          { id: 5, name: 'Grandchild', parentId: 2, lft: 3, rght: 4 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const path = await manager.getPath({ lft: 3, rght: 4 });

      expect(path).toHaveLength(3);
      expect(executed[0].sql).toContain('"lft" <= ?');
      expect(executed[0].sql).toContain('"rght" >= ?');
    });

    it('can exclude self from path', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 1, name: 'Root', parentId: null, lft: 1, rght: 14 },
          { id: 2, name: 'Child', parentId: 1, lft: 2, rght: 9 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      await manager.getPath({ lft: 3, rght: 4 }, false);

      expect(executed[0].sql).toContain('"lft" < ?');
      expect(executed[0].sql).toContain('"rght" > ?');
    });
  });

  describe('childCount', () => {
    it('calculates descendant count from bounds', () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor();

      const manager = new TreeManager({ executor, dialect, table });

      expect(manager.childCount({ lft: 1, rght: 2 })).toBe(0);
      expect(manager.childCount({ lft: 1, rght: 4 })).toBe(1);
      expect(manager.childCount({ lft: 1, rght: 14 })).toBe(6);
    });
  });

  describe('getLevel', () => {
    it('returns depth from node if available', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [{ id: 5, name: 'Node', parentId: 2, lft: 3, rght: 4, depth: 2 }],
      ]);

      const manager = new TreeManager({ executor, dialect, table, config: { depthKey: 'depth' } });
      const node = await manager.getNode(5);
      const level = await manager.getLevel(node!);

      expect(level).toBe(2);
    });

    it('calculates level from ancestors when depth not available', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [
          { id: 1, name: 'Root', parentId: null, lft: 1, rght: 8 },
          { id: 2, name: 'Child', parentId: 1, lft: 2, rght: 5 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const level = await manager.getLevel({ lft: 3, rght: 4 });

      expect(level).toBe(2);
    });
  });

  describe('getSiblings', () => {
    it('returns siblings by parent ID', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [{ id: 5, name: 'Node', parentId: 2, lft: 3, rght: 4 }],
        [
          { id: 5, name: 'Sibling1', parentId: 2, lft: 3, rght: 4 },
          { id: 6, name: 'Sibling2', parentId: 2, lft: 5, rght: 6 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const node = await manager.getNode(5);
      const siblings = await manager.getSiblings(node!, true);

      expect(siblings).toHaveLength(2);
    });
  });

  describe('getDescendantsThreaded', () => {
    it('returns threaded structure', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [
          { id: 1, name: 'Root', parentId: null, lft: 1, rght: 8 },
          { id: 2, name: 'Child1', parentId: 1, lft: 2, rght: 5 },
          { id: 4, name: 'Grandchild', parentId: 2, lft: 3, rght: 4 },
          { id: 3, name: 'Child2', parentId: 1, lft: 6, rght: 7 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const threaded = await manager.getDescendantsThreaded({ lft: 1, rght: 8 });

      expect(threaded).toHaveLength(1);
      expect((threaded[0].node as Record<string, unknown>).name).toBe('Root');
      expect(threaded[0].children).toHaveLength(2);
    });
  });

  describe('validate', () => {
    it('returns empty array for valid tree', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [
          { id: 1, lft: 1, rght: 6 },
          { id: 2, lft: 2, rght: 3 },
          { id: 3, lft: 4, rght: 5 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const errors = await manager.validate();

      expect(errors).toHaveLength(0);
    });

    it('returns errors for invalid tree', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([
        [
          { id: 1, lft: 5, rght: 3 },
        ],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const errors = await manager.validate();

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('must be less than');
    });
  });

  describe('withScope', () => {
    it('creates new manager with scope applied', async () => {
      const table = defineTable('scoped_categories', {
        id: col.primaryKey(col.int()),
        name: col.varchar(255),
        parentId: col.int(),
        lft: col.int(),
        rght: col.int(),
        tenantId: col.int(),
      });
      const { executor, executed } = createMockExecutor([[]]);

      const manager = new TreeManager({
        executor,
        dialect,
        table,
        config: { scope: ['tenantId'] },
      });

      const scopedManager = manager.withScope({ tenantId: 42 });
      await scopedManager.getRoots();

      expect(executed[0].sql).toContain('"tenantId" = ?');
      expect(executed[0].params).toContain(42);
    });
  });

  describe('recover', () => {
    it('rebuilds tree from parent_id', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [
          { id: 1, parentId: null, lft: 0, rght: 0 },
          { id: 2, parentId: 1, lft: 0, rght: 0 },
          { id: 3, parentId: 1, lft: 0, rght: 0 },
        ],
        [],
        [],
        [],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const result = await manager.recover();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(3);

      const updateCalls = executed.filter(e => e.sql.includes('UPDATE'));
      expect(updateCalls).toHaveLength(3);
    });

    it('returns error on failure', async () => {
      const table = createCategoriesTable();
      const executor: DbExecutor = {
        capabilities: { transactions: true },
        async executeSql(): Promise<QueryResult[]> {
          throw new Error('Database error');
        },
        beginTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        rollbackTransaction: vi.fn(),
        dispose: vi.fn(),
      };

      const manager = new TreeManager({ executor, dialect, table });
      const result = await manager.recover();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Database error');
    });
  });

  describe('insertAsChild', () => {
    it('inserts new root node', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [{ max_rght: 0 }],
        [],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      await manager.insertAsChild(null, { name: 'New Root' });

      const insertCall = executed.find(e => e.sql.includes('INSERT'));
      expect(insertCall).toBeDefined();
      expect(insertCall!.sql).toContain('"categories"');
    });

    it('inserts child under parent', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [{ id: 1, name: 'Parent', parentId: null, lft: 1, rght: 2, depth: 0 }],
        [],
        [],
        [],
      ]);

      const manager = new TreeManager({ executor, dialect, table, config: { depthKey: 'depth' } });
      await manager.insertAsChild(1, { name: 'New Child' });

      const updateCalls = executed.filter(e => e.sql.includes('UPDATE'));
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);

      const insertCall = executed.find(e => e.sql.includes('INSERT'));
      expect(insertCall).toBeDefined();
    });

    it('throws when parent not found', async () => {
      const table = createCategoriesTable();
      const { executor } = createMockExecutor([[]]);

      const manager = new TreeManager({ executor, dialect, table });

      await expect(manager.insertAsChild(999, { name: 'Orphan' })).rejects.toThrow('not found');
    });
  });

  describe('deleteSubtree', () => {
    it('deletes node and descendants', async () => {
      const table = createCategoriesTable();
      const { executor, executed } = createMockExecutor([
        [],
        [],
        [],
      ]);

      const manager = new TreeManager({ executor, dialect, table });
      const node = {
        data: { id: 2 },
        lft: 2,
        rght: 5,
        parentId: 1,
        isLeaf: false,
        isRoot: false,
        childCount: 1,
      };

      await manager.deleteSubtree(node);

      const deleteCall = executed.find(e => e.sql.includes('DELETE'));
      expect(deleteCall).toBeDefined();
      expect(deleteCall!.sql).toContain('"lft" >= ?');
      expect(deleteCall!.sql).toContain('"rght" <= ?');
    });
  });
});

describe('createTreeManager', () => {
  it('creates manager from session-like object', () => {
    const table = createCategoriesTable();
    const { executor } = createMockExecutor();
    const dialect = new SqliteDialect();

    const mockSession = {
      executor,
      dialect,
    } as unknown as OrmSession;

    const manager = createTreeManager(
      mockSession,
      table
    );

    expect(manager).toBeInstanceOf(TreeManager);
    expect(manager.table).toBe(table);
  });
});

describe('NestedSetStrategy integration', () => {
  it('recover generates correct updates', () => {
    const nodes = [
      { pk: 1, lft: 0, rght: 0, parentId: null },
      { pk: 2, lft: 0, rght: 0, parentId: 1 },
      { pk: 3, lft: 0, rght: 0, parentId: 1 },
      { pk: 4, lft: 0, rght: 0, parentId: 2 },
    ];

    const updates = NestedSetStrategy.recover(nodes);

    const node1 = updates.find(u => u.pk === 1)!;
    const node2 = updates.find(u => u.pk === 2)!;
    const node3 = updates.find(u => u.pk === 3)!;
    const node4 = updates.find(u => u.pk === 4)!;

    expect(node1).toEqual({ pk: 1, lft: 1, rght: 8, depth: 0 });
    expect(node2).toEqual({ pk: 2, lft: 2, rght: 5, depth: 1 });
    expect(node4).toEqual({ pk: 4, lft: 3, rght: 4, depth: 2 });
    expect(node3).toEqual({ pk: 3, lft: 6, rght: 7, depth: 1 });
  });
});
