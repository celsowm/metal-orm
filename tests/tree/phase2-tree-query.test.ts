import { describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import {
  treeQuery,
  threadResults,
  formatTreeList,
  calculateRowDepths,
} from '../../src/tree/tree-query.js';

const createCategoriesTable = () =>
  defineTable('categories', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    parentId: col.int(),
    lft: col.int(),
    rght: col.int(),
    depth: col.int(),
  });

const createScopedTable = () =>
  defineTable('scoped_categories', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    parentId: col.int(),
    lft: col.int(),
    rght: col.int(),
    tenantId: col.int(),
  });

describe('treeQuery', () => {
  describe('creation', () => {
    it('creates a tree query with default config', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);

      expect(tree.table).toBe(table);
      expect(tree.config.parentKey).toBe('parentId');
      expect(tree.config.leftKey).toBe('lft');
      expect(tree.config.rightKey).toBe('rght');
    });

    it('creates a tree query with custom config', () => {
      const table = defineTable('custom', {
        id: col.primaryKey(col.int()),
        ancestor_id: col.int(),
        tree_left: col.int(),
        tree_right: col.int(),
      });

      const tree = treeQuery(table, {
        parentKey: 'ancestor_id',
        leftKey: 'tree_left',
        rightKey: 'tree_right',
      });

      expect(tree.config.parentKey).toBe('ancestor_id');
      expect(tree.config.leftKey).toBe('tree_left');
      expect(tree.config.rightKey).toBe('tree_right');
    });

    it('throws for missing required columns', () => {
      const table = defineTable('incomplete', {
        id: col.primaryKey(col.int()),
        parentId: col.int(),
      });

      expect(() => treeQuery(table)).toThrow('missing columns lft, rght');
    });
  });

  describe('findRoots', () => {
    it('generates query for root nodes', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findRoots();
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`parentId` IS NULL');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` ASC');
    });

    it('works with PostgreSQL dialect', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findRoots();
      const { sql } = query.compile(new PostgresDialect());

      expect(sql).toContain('FROM "categories"');
      expect(sql).toContain('"parentId" IS NULL');
    });

    it('works with SQLite dialect', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findRoots();
      const { sql } = query.compile(new SqliteDialect());

      expect(sql).toContain('FROM "categories"');
      expect(sql).toContain('"parentId" IS NULL');
    });
  });

  describe('findDirectChildren', () => {
    it('generates query for direct children by parent ID', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findDirectChildren(1);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`parentId` = ?');
      expect(params).toContain(1);
    });

    it('orders by lft', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findDirectChildren(1);
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` ASC');
    });
  });

  describe('findDescendants', () => {
    it('generates query for all descendants using bounds', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findDescendants({ lft: 1, rght: 14 });
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`lft` > ?');
      expect(sql).toContain('`rght` < ?');
      expect(params).toContain(1);
      expect(params).toContain(14);
    });

    it('orders by lft', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findDescendants({ lft: 1, rght: 14 });
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` ASC');
    });
  });

  describe('findParentById', () => {
    it('generates query for parent node by ID', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findParentById(5);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`id` = ?');
      expect(params).toContain(5);
    });
  });

  describe('findSiblings', () => {
    it('generates query for siblings by parent ID', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findSiblings(2);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`parentId` = ?');
      expect(params).toContain(2);
    });

    it('excludes specified ID when provided', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findSiblings(2, 5);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toMatch(/`id` (!=|<>) \?/);
      expect(params).toContain(5);
    });

    it('includes all siblings when excludeId not provided', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findSiblings(2);
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).not.toContain('`id` <> ?');
    });
  });

  describe('findLeaves', () => {
    it('generates query for leaf nodes', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findLeaves();
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`rght` -');
      expect(sql).toContain('`lft`)');
      expect(sql).toContain('= ?');
      expect(params).toContain(1);
    });
  });

  describe('findSubtree', () => {
    it('generates query for node and all descendants', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findSubtree({ lft: 1, rght: 14 });
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`lft` >= ?');
      expect(sql).toContain('`rght` <= ?');
      expect(params).toContain(1);
      expect(params).toContain(14);
    });
  });

  describe('findAncestors', () => {
    it('generates query for path to root including self', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findAncestors({ lft: 3, rght: 4 });
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`lft` <= ?');
      expect(sql).toContain('`rght` >= ?');
      expect(params).toContain(3);
      expect(params).toContain(4);
    });

    it('generates query excluding self when requested', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findAncestors({ lft: 3, rght: 4 }, { includeSelf: false });
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('`lft` < ?');
      expect(sql).toContain('`rght` > ?');
    });

    it('orders by lft ascending by default (root first)', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findAncestors({ lft: 3, rght: 4 });
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` ASC');
    });

    it('orders by lft descending when requested (node first)', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findAncestors({ lft: 3, rght: 4 }, { order: 'desc' });
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` DESC');
    });
  });

  describe('findTreeList', () => {
    it('generates query ordered by lft', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findTreeList();
      const { sql } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('`lft` ASC');
    });
  });

  describe('findAtDepth', () => {
    it('generates query for specific depth level', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table, { depthKey: 'depth' });
      const query = tree.findAtDepth(2);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('`depth` = ?');
      expect(params).toContain(2);
    });

    it('throws when depthKey not configured', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);

      expect(() => tree.findAtDepth(2)).toThrow('depthKey');
    });
  });

  describe('findById', () => {
    it('generates query for node by ID', () => {
      const table = createCategoriesTable();
      const tree = treeQuery(table);
      const query = tree.findById(5);
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('FROM `categories`');
      expect(sql).toContain('`id` = ?');
      expect(params).toContain(5);
    });
  });

  describe('withScope', () => {
    it('applies scope conditions to queries', () => {
      const table = createScopedTable();
      const tree = treeQuery(table, {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        scope: ['tenantId'],
      });

      const scopedTree = tree.withScope({ tenantId: 42 });
      const query = scopedTree.findRoots();
      const { sql, params } = query.compile(new MySqlDialect());

      expect(sql).toContain('`tenantId` = ?');
      expect(params).toContain(42);
    });

    it('returns new instance without modifying original', () => {
      const table = createScopedTable();
      const tree = treeQuery(table, {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        scope: ['tenantId'],
      });

      const scopedTree = tree.withScope({ tenantId: 42 });
      const originalQuery = tree.findRoots();
      const { sql: originalSql } = originalQuery.compile(new MySqlDialect());

      expect(originalSql).not.toContain('`tenantId` = ?');
    });

    it('scope applies to all query types', () => {
      const table = createScopedTable();
      const tree = treeQuery(table, {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        scope: ['tenantId'],
      }).withScope({ tenantId: 99 });

      const dialect = new MySqlDialect();

      const queries = [
        tree.findRoots(),
        tree.findDirectChildren(1),
        tree.findLeaves(),
        tree.findTreeList(),
        tree.findDescendants({ lft: 1, rght: 10 }),
      ];

      for (const query of queries) {
        const { sql, params } = query.compile(dialect);
        expect(sql).toContain('`tenantId` = ?');
        expect(params).toContain(99);
      }
    });
  });
});

describe('threadResults', () => {
  it('converts flat results to threaded structure', () => {
    const rows = [
      { id: 1, name: 'Root', lft: 1, rght: 8 },
      { id: 2, name: 'Child1', lft: 2, rght: 5 },
      { id: 4, name: 'Grandchild', lft: 3, rght: 4 },
      { id: 3, name: 'Child2', lft: 6, rght: 7 },
    ];

    const threaded = threadResults(rows);

    expect(threaded).toHaveLength(1);
    expect(threaded[0].node.name).toBe('Root');
    expect(threaded[0].children).toHaveLength(2);
    expect(threaded[0].children[0].node.name).toBe('Child1');
    expect(threaded[0].children[0].children[0].node.name).toBe('Grandchild');
    expect(threaded[0].children[1].node.name).toBe('Child2');
  });

  it('handles custom column names', () => {
    const rows = [
      { id: 1, tree_left: 1, tree_right: 4 },
      { id: 2, tree_left: 2, tree_right: 3 },
    ];

    const threaded = threadResults(rows, 'tree_left', 'tree_right');

    expect(threaded).toHaveLength(1);
    expect(threaded[0].node.id).toBe(1);
    expect(threaded[0].children).toHaveLength(1);
    expect(threaded[0].children[0].node.id).toBe(2);
  });

  it('handles empty input', () => {
    const threaded = threadResults([]);
    expect(threaded).toHaveLength(0);
  });

  it('handles multiple roots', () => {
    const rows = [
      { id: 1, lft: 1, rght: 2 },
      { id: 2, lft: 3, rght: 4 },
    ];

    const threaded = threadResults(rows);

    expect(threaded).toHaveLength(2);
    expect(threaded[0].node.id).toBe(1);
    expect(threaded[1].node.id).toBe(2);
  });
});

describe('formatTreeList', () => {
  it('formats tree for dropdown with default options', () => {
    const rows = [
      { id: 1, name: 'Root', lft: 1, rght: 6 },
      { id: 2, name: 'Child1', lft: 2, rght: 3 },
      { id: 3, name: 'Child2', lft: 4, rght: 5 },
    ];

    const list = formatTreeList(rows, { valuePath: 'name' });

    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ key: 1, value: 'Root', depth: 0 });
    expect(list[1]).toEqual({ key: 2, value: '__Child1', depth: 1 });
    expect(list[2]).toEqual({ key: 3, value: '__Child2', depth: 1 });
  });

  it('uses custom spacer', () => {
    const rows = [
      { id: 1, name: 'Root', lft: 1, rght: 4 },
      { id: 2, name: 'Child', lft: 2, rght: 3 },
    ];

    const list = formatTreeList(rows, { valuePath: 'name', spacer: '— ' });

    expect(list[0].value).toBe('Root');
    expect(list[1].value).toBe('— Child');
  });

  it('uses depth column when available', () => {
    const rows = [
      { id: 1, name: 'Root', lft: 1, rght: 4, depth: 0 },
      { id: 2, name: 'Child', lft: 2, rght: 3, depth: 1 },
    ];

    const list = formatTreeList(rows, { valuePath: 'name', depthKey: 'depth' });

    expect(list[0].depth).toBe(0);
    expect(list[1].depth).toBe(1);
  });

  it('handles custom key path', () => {
    const rows = [
      { uuid: 'abc', name: 'Node', lft: 1, rght: 2 },
    ];

    const list = formatTreeList(rows, { keyPath: 'uuid', valuePath: 'name' });

    expect(list[0].key).toBe('abc');
  });
});

describe('calculateRowDepths', () => {
  it('calculates depths for flat rows', () => {
    const rows = [
      { id: 1, lft: 1, rght: 8 },
      { id: 2, lft: 2, rght: 5 },
      { id: 4, lft: 3, rght: 4 },
      { id: 3, lft: 6, rght: 7 },
    ];

    const depths = calculateRowDepths(rows);

    expect(depths.get(rows[0])).toBe(0);
    expect(depths.get(rows[1])).toBe(1);
    expect(depths.get(rows[2])).toBe(2);
    expect(depths.get(rows[3])).toBe(1);
  });

  it('handles custom column names', () => {
    const rows = [
      { id: 1, tree_l: 1, tree_r: 4 },
      { id: 2, tree_l: 2, tree_r: 3 },
    ];

    const depths = calculateRowDepths(rows, 'tree_l', 'tree_r');

    expect(depths.get(rows[0])).toBe(0);
    expect(depths.get(rows[1])).toBe(1);
  });
});
