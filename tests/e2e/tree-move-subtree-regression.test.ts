import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import {
  createSqliteExecutor,
  type SqliteClientLike,
} from '../../src/core/execution/executors/sqlite-executor.js';
import { TreeManager } from '../../src/tree/tree-manager.js';
import { closeDb, execSql } from './sqlite-helpers.js';

const categories = defineTable('tree_move_regression', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  parentId: col.int(),
  lft: col.int(),
  rght: col.int(),
});

const createSqliteClient = (db: sqlite3.Database): SqliteClientLike => ({
  all(sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params ?? [], (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows as Record<string, unknown>[]);
      });
    });
  },
});

describe('TreeManager subtree move regression', () => {
  it('keeps a moved subtree isolated from gap shifts', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      await execSql(db, `
        CREATE TABLE tree_move_regression (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          parentId INTEGER,
          lft INTEGER NOT NULL,
          rght INTEGER NOT NULL
        );

        INSERT INTO tree_move_regression (id, name, parentId, lft, rght) VALUES
          (1, 'Root', NULL, 1, 10),
          (2, 'Child1', 1, 2, 5),
          (3, 'Child2', 1, 6, 9),
          (4, 'Grandchild1', 2, 3, 4),
          (5, 'Grandchild2', 3, 7, 8);
      `);

      const manager = new TreeManager({
        executor: createSqliteExecutor(createSqliteClient(db)),
        dialect: new SqliteDialect(),
        table: categories,
      });

      const child2 = await manager.getNode(3);
      expect(child2).not.toBeNull();
      expect(child2!.rght - child2!.lft + 1).toBe(4);

      await manager.moveTo(child2!, 2);

      const root = await manager.getNode(1);
      const child1 = await manager.getNode(2);
      const moved = await manager.getNode(3);
      const grandchild1 = await manager.getNode(4);
      const grandchild2 = await manager.getNode(5);

      expect([root!.lft, root!.rght]).toEqual([1, 10]);
      expect([child1!.lft, child1!.rght]).toEqual([2, 9]);
      expect([grandchild1!.lft, grandchild1!.rght]).toEqual([3, 4]);
      expect([moved!.lft, moved!.rght]).toEqual([5, 8]);
      expect([grandchild2!.lft, grandchild2!.rght]).toEqual([6, 7]);
      expect(moved!.parentId).toBe(2);

      expect(await manager.validate()).toEqual([]);
    } finally {
      await closeDb(db);
    }
  });
});
