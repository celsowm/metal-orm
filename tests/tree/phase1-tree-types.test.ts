import { describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import {
  TreeConfig,
  DEFAULT_TREE_CONFIG,
  isTreeConfig,
  resolveTreeConfig,
  validateTreeTable,
  getTreeColumns,
} from '../../src/tree/tree-types.js';
import {
  NestedSetStrategy,
  NestedSetRow,
  NodeWithPk,
  buildScopeConditions,
  extractScopeValues,
} from '../../src/tree/nested-set-strategy.js';

describe('Tree Types', () => {
  describe('DEFAULT_TREE_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_TREE_CONFIG.parentKey).toBe('parentId');
      expect(DEFAULT_TREE_CONFIG.leftKey).toBe('lft');
      expect(DEFAULT_TREE_CONFIG.rightKey).toBe('rght');
      expect(DEFAULT_TREE_CONFIG.cascadeCallbacks).toBe(false);
    });
  });

  describe('isTreeConfig', () => {
    it('returns true for valid config', () => {
      const config: TreeConfig = {
        parentKey: 'parent_id',
        leftKey: 'left_val',
        rightKey: 'right_val',
      };
      expect(isTreeConfig(config)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isTreeConfig(null)).toBe(false);
    });

    it('returns false for missing required keys', () => {
      expect(isTreeConfig({ parentKey: 'a', leftKey: 'b' })).toBe(false);
      expect(isTreeConfig({ parentKey: 'a', rightKey: 'c' })).toBe(false);
      expect(isTreeConfig({ leftKey: 'b', rightKey: 'c' })).toBe(false);
    });

    it('returns false for non-string keys', () => {
      expect(isTreeConfig({ parentKey: 1, leftKey: 'b', rightKey: 'c' })).toBe(false);
    });
  });

  describe('resolveTreeConfig', () => {
    it('applies defaults for missing keys', () => {
      const config = resolveTreeConfig({});
      expect(config.parentKey).toBe('parentId');
      expect(config.leftKey).toBe('lft');
      expect(config.rightKey).toBe('rght');
      expect(config.cascadeCallbacks).toBe(false);
    });

    it('preserves provided values', () => {
      const config = resolveTreeConfig({
        parentKey: 'ancestor_id',
        leftKey: 'tree_left',
        rightKey: 'tree_right',
        depthKey: 'level',
        scope: ['tenant_id'],
        cascadeCallbacks: true,
      });
      expect(config.parentKey).toBe('ancestor_id');
      expect(config.leftKey).toBe('tree_left');
      expect(config.rightKey).toBe('tree_right');
      expect(config.depthKey).toBe('level');
      expect(config.scope).toEqual(['tenant_id']);
      expect(config.cascadeCallbacks).toBe(true);
    });
  });

  describe('validateTreeTable', () => {
    const createCategoriesTable = (columns: Record<string, ReturnType<typeof col.int>>) =>
      defineTable('categories', columns);

    it('validates a table with all required columns', () => {
      const table = createCategoriesTable({
        id: col.primaryKey(col.int()),
        parentId: col.int(),
        lft: col.int(),
        rght: col.int(),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const result = validateTreeTable(table, config);
      expect(result.valid).toBe(true);
      expect(result.missingColumns).toHaveLength(0);
    });

    it('reports missing required columns', () => {
      const table = createCategoriesTable({
        id: col.primaryKey(col.int()),
        parentId: col.int(),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const result = validateTreeTable(table, config);
      expect(result.valid).toBe(false);
      expect(result.missingColumns).toContain('lft');
      expect(result.missingColumns).toContain('rght');
    });

    it('warns about missing optional depth column', () => {
      const table = createCategoriesTable({
        id: col.primaryKey(col.int()),
        parentId: col.int(),
        lft: col.int(),
        rght: col.int(),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        depthKey: 'depth',
      };

      const result = validateTreeTable(table, config);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain("Optional depth column 'depth' not found in table 'categories'");
    });

    it('validates scope columns', () => {
      const table = createCategoriesTable({
        id: col.primaryKey(col.int()),
        parentId: col.int(),
        lft: col.int(),
        rght: col.int(),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        scope: ['tenantId'],
      };

      const result = validateTreeTable(table, config);
      expect(result.valid).toBe(false);
      expect(result.missingColumns).toContain('tenantId');
    });
  });

  describe('getTreeColumns', () => {
    it('extracts tree columns from table', () => {
      const table = defineTable('categories', {
        id: col.primaryKey(col.int()),
        parentId: col.int(),
        lft: col.int(),
        rght: col.int(),
        depth: col.int(),
        tenantId: col.int(),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        depthKey: 'depth',
        scope: ['tenantId'],
      };

      const columns = getTreeColumns(table, config);
      expect(columns.parentColumn.name).toBe('parentId');
      expect(columns.leftColumn.name).toBe('lft');
      expect(columns.rightColumn.name).toBe('rght');
      expect(columns.depthColumn?.name).toBe('depth');
      expect(columns.scopeColumns).toHaveLength(1);
      expect(columns.scopeColumns[0].name).toBe('tenantId');
    });

    it('throws for missing required columns', () => {
      const table = defineTable('categories', {
        id: col.primaryKey(col.int()),
      });

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      expect(() => getTreeColumns(table, config)).toThrow(
        "Table 'categories' is missing required tree columns"
      );
    });
  });
});

describe('NestedSetStrategy', () => {
  describe('childCount', () => {
    it('returns 0 for leaf nodes', () => {
      expect(NestedSetStrategy.childCount(1, 2)).toBe(0);
      expect(NestedSetStrategy.childCount(5, 6)).toBe(0);
    });

    it('calculates correct count for nodes with children', () => {
      expect(NestedSetStrategy.childCount(1, 4)).toBe(1);
      expect(NestedSetStrategy.childCount(1, 6)).toBe(2);
      expect(NestedSetStrategy.childCount(1, 14)).toBe(6);
    });
  });

  describe('isLeaf', () => {
    it('returns true when rght - lft === 1', () => {
      expect(NestedSetStrategy.isLeaf(1, 2)).toBe(true);
      expect(NestedSetStrategy.isLeaf(7, 8)).toBe(true);
    });

    it('returns false when rght - lft > 1', () => {
      expect(NestedSetStrategy.isLeaf(1, 4)).toBe(false);
      expect(NestedSetStrategy.isLeaf(1, 14)).toBe(false);
    });
  });

  describe('isRoot', () => {
    it('returns true for null or undefined parent', () => {
      expect(NestedSetStrategy.isRoot(null)).toBe(true);
      expect(NestedSetStrategy.isRoot(undefined)).toBe(true);
    });

    it('returns false for non-null parent', () => {
      expect(NestedSetStrategy.isRoot(1)).toBe(false);
      expect(NestedSetStrategy.isRoot(0)).toBe(false);
      expect(NestedSetStrategy.isRoot('')).toBe(false);
    });
  });

  describe('isAncestorOf / isDescendantOf', () => {
    const root = { lft: 1, rght: 14 };
    const child = { lft: 2, rght: 9 };
    const grandchild = { lft: 3, rght: 4 };
    const sibling = { lft: 10, rght: 13 };

    it('correctly identifies ancestors', () => {
      expect(NestedSetStrategy.isAncestorOf(root, child)).toBe(true);
      expect(NestedSetStrategy.isAncestorOf(root, grandchild)).toBe(true);
      expect(NestedSetStrategy.isAncestorOf(child, grandchild)).toBe(true);
    });

    it('correctly rejects non-ancestors', () => {
      expect(NestedSetStrategy.isAncestorOf(child, root)).toBe(false);
      expect(NestedSetStrategy.isAncestorOf(grandchild, child)).toBe(false);
      expect(NestedSetStrategy.isAncestorOf(child, sibling)).toBe(false);
    });

    it('correctly identifies descendants', () => {
      expect(NestedSetStrategy.isDescendantOf(child, root)).toBe(true);
      expect(NestedSetStrategy.isDescendantOf(grandchild, root)).toBe(true);
      expect(NestedSetStrategy.isDescendantOf(grandchild, child)).toBe(true);
    });

    it('correctly rejects non-descendants', () => {
      expect(NestedSetStrategy.isDescendantOf(root, child)).toBe(false);
      expect(NestedSetStrategy.isDescendantOf(sibling, child)).toBe(false);
    });
  });

  describe('subtreeWidth', () => {
    it('returns correct width', () => {
      expect(NestedSetStrategy.subtreeWidth(1, 2)).toBe(2);
      expect(NestedSetStrategy.subtreeWidth(1, 14)).toBe(14);
      expect(NestedSetStrategy.subtreeWidth(3, 8)).toBe(6);
    });
  });

  describe('createTreeNode', () => {
    it('creates TreeNode from row data', () => {
      const row: NestedSetRow = {
        id: 1,
        name: 'Root',
        lft: 1,
        rght: 14,
        parentId: null,
        depth: 0,
      };

      const node = NestedSetStrategy.createTreeNode(row);
      expect(node.entity).toBe(row);
      expect(node.lft).toBe(1);
      expect(node.rght).toBe(14);
      expect(node.depth).toBe(0);
      expect(node.isLeaf).toBe(false);
      expect(node.isRoot).toBe(true);
      expect(node.childCount).toBe(6);
    });

    it('identifies leaf nodes correctly', () => {
      const row: NestedSetRow = {
        id: 5,
        lft: 3,
        rght: 4,
        parentId: 2,
      };

      const node = NestedSetStrategy.createTreeNode(row);
      expect(node.isLeaf).toBe(true);
      expect(node.isRoot).toBe(false);
      expect(node.childCount).toBe(0);
    });
  });

  describe('calculateInsertAsLastChild', () => {
    it('calculates position for new child', () => {
      const result = NestedSetStrategy.calculateInsertAsLastChild(10, 1);
      expect(result.lft).toBe(10);
      expect(result.rght).toBe(11);
      expect(result.depth).toBe(2);
    });

    it('calculates position for root child', () => {
      const result = NestedSetStrategy.calculateInsertAsLastChild(14, 0);
      expect(result.lft).toBe(14);
      expect(result.rght).toBe(15);
      expect(result.depth).toBe(1);
    });
  });

  describe('calculateInsertAsFirstChild', () => {
    it('calculates position for first child', () => {
      const result = NestedSetStrategy.calculateInsertAsFirstChild(1, 0);
      expect(result.lft).toBe(2);
      expect(result.rght).toBe(3);
      expect(result.depth).toBe(1);
    });
  });

  describe('calculateInsertAsRoot', () => {
    it('calculates position for new root in empty tree', () => {
      const result = NestedSetStrategy.calculateInsertAsRoot(0);
      expect(result.lft).toBe(1);
      expect(result.rght).toBe(2);
      expect(result.depth).toBe(0);
    });

    it('calculates position for additional root', () => {
      const result = NestedSetStrategy.calculateInsertAsRoot(14);
      expect(result.lft).toBe(15);
      expect(result.rght).toBe(16);
      expect(result.depth).toBe(0);
    });
  });

  describe('calculateLftShiftForInsert / calculateRghtShiftForInsert', () => {
    it('returns correct threshold and delta', () => {
      const lftShift = NestedSetStrategy.calculateLftShiftForInsert(5, 2);
      expect(lftShift.threshold).toBe(5);
      expect(lftShift.delta).toBe(2);

      const rghtShift = NestedSetStrategy.calculateRghtShiftForInsert(5, 2);
      expect(rghtShift.threshold).toBe(5);
      expect(rghtShift.delta).toBe(2);
    });

    it('uses default width of 2', () => {
      const shift = NestedSetStrategy.calculateLftShiftForInsert(10);
      expect(shift.delta).toBe(2);
    });
  });

  describe('calculateDeleteGap', () => {
    it('returns correct gap info', () => {
      const gap = NestedSetStrategy.calculateDeleteGap(3, 8);
      expect(gap.start).toBe(3);
      expect(gap.width).toBe(6);
    });

    it('returns width of 2 for leaf', () => {
      const gap = NestedSetStrategy.calculateDeleteGap(5, 6);
      expect(gap.width).toBe(2);
    });
  });

  describe('calculateShiftForDelete', () => {
    it('returns negative delta', () => {
      const shift = NestedSetStrategy.calculateShiftForDelete(8, 6);
      expect(shift.threshold).toBe(8);
      expect(shift.delta).toBe(-6);
    });
  });

  describe('calculateMoveUp / calculateMoveDown', () => {
    const node = { lft: 5, rght: 8 };
    const prevSibling = { lft: 2, rght: 4 };
    const nextSibling = { lft: 9, rght: 12 };

    it('calculates moveUp correctly', () => {
      const result = NestedSetStrategy.calculateMoveUp(node, prevSibling);
      expect(result).not.toBeNull();
      expect(result!.nodeShift).toBe(-3);
      expect(result!.siblingShift).toBe(4);
    });

    it('returns null when no previous sibling', () => {
      expect(NestedSetStrategy.calculateMoveUp(node, null)).toBeNull();
    });

    it('calculates moveDown correctly', () => {
      const result = NestedSetStrategy.calculateMoveDown(node, nextSibling);
      expect(result).not.toBeNull();
      expect(result!.nodeShift).toBe(4);
      expect(result!.siblingShift).toBe(-4);
    });

    it('returns null when no next sibling', () => {
      expect(NestedSetStrategy.calculateMoveDown(node, null)).toBeNull();
    });
  });

  describe('recover', () => {
    it('rebuilds tree from parent_id relationships', () => {
      const nodes: NodeWithPk<number>[] = [
        { pk: 1, lft: 0, rght: 0, parentId: null },
        { pk: 2, lft: 0, rght: 0, parentId: 1 },
        { pk: 3, lft: 0, rght: 0, parentId: 1 },
        { pk: 4, lft: 0, rght: 0, parentId: 2 },
      ];

      const updates = NestedSetStrategy.recover(nodes);

      expect(updates).toHaveLength(4);
      
      const node1 = updates.find(u => u.pk === 1)!;
      const node2 = updates.find(u => u.pk === 2)!;
      const node3 = updates.find(u => u.pk === 3)!;
      const node4 = updates.find(u => u.pk === 4)!;

      expect(node1.lft).toBe(1);
      expect(node1.rght).toBe(8);
      expect(node1.depth).toBe(0);

      expect(node2.lft).toBe(2);
      expect(node2.rght).toBe(5);
      expect(node2.depth).toBe(1);

      expect(node4.lft).toBe(3);
      expect(node4.rght).toBe(4);
      expect(node4.depth).toBe(2);

      expect(node3.lft).toBe(6);
      expect(node3.rght).toBe(7);
      expect(node3.depth).toBe(1);
    });

    it('handles empty input', () => {
      const updates = NestedSetStrategy.recover([]);
      expect(updates).toHaveLength(0);
    });

    it('handles multiple roots', () => {
      const nodes: NodeWithPk<number>[] = [
        { pk: 1, lft: 0, rght: 0, parentId: null },
        { pk: 2, lft: 0, rght: 0, parentId: null },
      ];

      const updates = NestedSetStrategy.recover(nodes);

      expect(updates).toHaveLength(2);
      expect(updates[0].lft).toBe(1);
      expect(updates[0].rght).toBe(2);
      expect(updates[1].lft).toBe(3);
      expect(updates[1].rght).toBe(4);
    });

    it('respects custom ordering', () => {
      const nodes: NodeWithPk<number>[] = [
        { pk: 1, lft: 0, rght: 0, parentId: null },
        { pk: 2, lft: 0, rght: 0, parentId: 1 },
        { pk: 3, lft: 0, rght: 0, parentId: 1 },
      ];

      const updates = NestedSetStrategy.recover(nodes, (a, b) => b.pk - a.pk);

      const node2 = updates.find(u => u.pk === 2)!;
      const node3 = updates.find(u => u.pk === 3)!;

      expect(node3.lft).toBeLessThan(node2.lft);
    });
  });

  describe('toThreaded', () => {
    it('converts flat list to threaded structure', () => {
      interface SimpleNode { id: number; lft: number; rght: number; name: string }
      const nodes: SimpleNode[] = [
        { id: 1, lft: 1, rght: 8, name: 'Root' },
        { id: 2, lft: 2, rght: 5, name: 'Child1' },
        { id: 4, lft: 3, rght: 4, name: 'Grandchild' },
        { id: 3, lft: 6, rght: 7, name: 'Child2' },
      ];

      const threaded = NestedSetStrategy.toThreaded(
        nodes,
        n => n.lft,
        n => n.rght
      );

      expect(threaded).toHaveLength(1);
      expect(threaded[0].node.name).toBe('Root');
      expect(threaded[0].children).toHaveLength(2);
      expect(threaded[0].children[0].node.name).toBe('Child1');
      expect(threaded[0].children[0].children).toHaveLength(1);
      expect(threaded[0].children[0].children[0].node.name).toBe('Grandchild');
      expect(threaded[0].children[1].node.name).toBe('Child2');
      expect(threaded[0].children[1].children).toHaveLength(0);
    });

    it('handles empty input', () => {
      const threaded = NestedSetStrategy.toThreaded([], n => n, n => n);
      expect(threaded).toHaveLength(0);
    });

    it('handles multiple roots', () => {
      const nodes = [
        { id: 1, lft: 1, rght: 2 },
        { id: 2, lft: 3, rght: 4 },
      ];

      const threaded = NestedSetStrategy.toThreaded(
        nodes,
        n => n.lft,
        n => n.rght
      );

      expect(threaded).toHaveLength(2);
    });
  });

  describe('toTreeList', () => {
    it('generates list with depth prefixes', () => {
      const nodes = [
        { id: 1, name: 'Root', depth: 0 },
        { id: 2, name: 'Child1', depth: 1 },
        { id: 3, name: 'Grandchild', depth: 2 },
        { id: 4, name: 'Child2', depth: 1 },
      ];

      const list = NestedSetStrategy.toTreeList(
        nodes,
        n => n.id,
        n => n.name,
        n => n.depth,
        '_'
      );

      expect(list).toEqual([
        { key: 1, value: 'Root', depth: 0 },
        { key: 2, value: '_Child1', depth: 1 },
        { key: 3, value: '__Grandchild', depth: 2 },
        { key: 4, value: '_Child2', depth: 1 },
      ]);
    });

    it('uses default spacer', () => {
      const nodes = [{ id: 1, name: 'Test', depth: 2 }];

      const list = NestedSetStrategy.toTreeList(
        nodes,
        n => n.id,
        n => n.name,
        n => n.depth
      );

      expect(list[0].value).toBe('____Test');
    });
  });

  describe('validateTree', () => {
    it('passes for valid tree', () => {
      const nodes = [
        { id: 1, lft: 1, rght: 6 },
        { id: 2, lft: 2, rght: 3 },
        { id: 3, lft: 4, rght: 5 },
      ];

      const errors = NestedSetStrategy.validateTree(
        nodes,
        n => n.lft,
        n => n.rght,
        n => n.id
      );

      expect(errors).toHaveLength(0);
    });

    it('detects lft >= rght', () => {
      const nodes = [{ id: 1, lft: 5, rght: 3 }];

      const errors = NestedSetStrategy.validateTree(
        nodes,
        n => n.lft,
        n => n.rght,
        n => n.id
      );

      expect(errors).toContain('Node 1: lft (5) must be less than rght (3)');
    });

    it('detects negative lft', () => {
      const nodes = [{ id: 1, lft: -1, rght: 2 }];

      const errors = NestedSetStrategy.validateTree(
        nodes,
        n => n.lft,
        n => n.rght,
        n => n.id
      );

      expect(errors).toContain('Node 1: lft (-1) must be positive');
    });

    it('detects overlapping nodes', () => {
      const nodes = [
        { id: 1, lft: 1, rght: 6 },
        { id: 2, lft: 3, rght: 8 },
      ];

      const errors = NestedSetStrategy.validateTree(
        nodes,
        n => n.lft,
        n => n.rght,
        n => n.id
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('overlaps');
    });
  });

  describe('calculateDepths', () => {
    it('calculates depths for tree nodes', () => {
      const nodes = [
        { id: 1, lft: 1, rght: 8 },
        { id: 2, lft: 2, rght: 5 },
        { id: 4, lft: 3, rght: 4 },
        { id: 3, lft: 6, rght: 7 },
      ];

      const depths = NestedSetStrategy.calculateDepths(
        nodes,
        n => n.lft,
        n => n.rght
      );

      expect(depths.get(nodes[0])).toBe(0);
      expect(depths.get(nodes[1])).toBe(1);
      expect(depths.get(nodes[2])).toBe(2);
      expect(depths.get(nodes[3])).toBe(1);
    });
  });
});

describe('Scope utilities', () => {
  describe('buildScopeConditions', () => {
    it('builds conditions from scope values', () => {
      const conditions = buildScopeConditions(
        ['tenantId', 'regionId'],
        { tenantId: 1, regionId: 'us-east' }
      );

      expect(conditions).toEqual({ tenantId: 1, regionId: 'us-east' });
    });

    it('returns empty for no scope', () => {
      expect(buildScopeConditions(undefined, {})).toEqual({});
      expect(buildScopeConditions([], { tenantId: 1 })).toEqual({});
    });

    it('only includes scope keys', () => {
      const conditions = buildScopeConditions(
        ['tenantId'],
        { tenantId: 1, extra: 'ignored' }
      );

      expect(conditions).toEqual({ tenantId: 1 });
    });
  });

  describe('extractScopeValues', () => {
    it('extracts scope values from entity', () => {
      const entity = { id: 1, name: 'Test', tenantId: 5, regionId: 'eu' };
      const values = extractScopeValues(entity, ['tenantId', 'regionId']);

      expect(values).toEqual({ tenantId: 5, regionId: 'eu' });
    });

    it('returns empty for no scope', () => {
      expect(extractScopeValues({ id: 1 }, undefined)).toEqual({});
      expect(extractScopeValues({ id: 1 }, [])).toEqual({});
    });

    it('only includes existing keys', () => {
      const entity = { id: 1, tenantId: 5 };
      const values = extractScopeValues(entity, ['tenantId', 'missing']);

      expect(values).toEqual({ tenantId: 5 });
    });
  });
});
