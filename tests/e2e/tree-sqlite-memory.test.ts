import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { createTreeManager } from '../../src/tree/tree-manager.js';
import {
  closeDb,
  createSqliteSessionFromDb,
} from './sqlite-helpers.ts';

const Categories = defineTable('tree_remove_categories', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  parentId: col.int(),
  lft: col.int(),
  rght: col.int(),
  depth: col.int(),
  tenantId: col.int(),
});

const asNumber = (value: unknown): number => {
  expect(typeof value).toBe('number');
  return value as number;
};

const nameOf = (node: { data: unknown }): string =>
  (node.data as Record<string, unknown>).name as string;

describe('TreeManager SQLite removeFromTree', () => {
  it('promotes children, retains the removed row as a valid root, and isolates scopes', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        Categories
      );

      const base = createTreeManager(
        session,
        Categories,
        { depthKey: 'depth', scope: ['tenantId'] }
      );
      const tenant1 = base.withScope({ tenantId: 1 });
      const tenant2 = base.withScope({ tenantId: 2 });

      const otherRootId = asNumber(
        await tenant2.insertAsChild(null, { name: 'Other Root' })
      );

      const rootId = asNumber(
        await tenant1.insertAsChild(null, { name: 'Root' })
      );
      const aId = asNumber(
        await tenant1.insertAsChild(rootId, { name: 'A' })
      );
      const xId = asNumber(
        await tenant1.insertAsChild(aId, { name: 'X' })
      );
      const yId = asNumber(
        await tenant1.insertAsChild(aId, { name: 'Y' })
      );
      const bId = asNumber(
        await tenant1.insertAsChild(rootId, { name: 'B' })
      );

      const a = await tenant1.getNode(aId);
      expect(a).not.toBeNull();
      expect(a).toMatchObject({ lft: 2, rght: 7, depth: 1 });

      await tenant1.removeFromTree(a!);

      expect(await tenant1.validate()).toEqual([]);

      const roots = await tenant1.getRoots();
      expect(roots).toHaveLength(2);
      expect(nameOf(roots[0])).toBe('Root');
      expect(roots[0]).toMatchObject({
        lft: 1,
        rght: 8,
        depth: 0,
        parentId: null,
      });
      expect(nameOf(roots[1])).toBe('A');
      expect(roots[1]).toMatchObject({
        lft: 9,
        rght: 10,
        depth: 0,
        parentId: null,
        isLeaf: true,
      });

      const children = await tenant1.getChildren(rootId);
      expect(children.map(nameOf)).toEqual(['X', 'Y', 'B']);

      const x = await tenant1.getNode(xId);
      const y = await tenant1.getNode(yId);
      const b = await tenant1.getNode(bId);
      expect(x).toMatchObject({ lft: 2, rght: 3, depth: 1, parentId: rootId });
      expect(y).toMatchObject({ lft: 4, rght: 5, depth: 1, parentId: rootId });
      expect(b).toMatchObject({ lft: 6, rght: 7, depth: 1, parentId: rootId });

      const detached = await tenant1.getNode(aId);
      expect(detached).toMatchObject({
        lft: 9,
        rght: 10,
        depth: 0,
        parentId: null,
        isRoot: true,
        isLeaf: true,
      });

      const otherRoot = await tenant2.getNode(otherRootId);
      expect(otherRoot).toMatchObject({ lft: 1, rght: 2, depth: 0, parentId: null });
      expect(await tenant2.validate()).toEqual([]);
    } finally {
      await closeDb(db);
    }
  });
});
