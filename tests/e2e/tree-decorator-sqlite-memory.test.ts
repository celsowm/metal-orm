/**
 * E2E Test: Tree Decorator with SQLite In-Memory Database
 * 
 * Tests the full integration of @Tree(), @TreeParent(), @TreeChildren() decorators
 * with the MetalORM runtime using SQLite in-memory database.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  PrimaryKey,
  getTableDefFromEntity,
} from '../../src/decorators/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql,
  execSql
} from './sqlite-helpers.js';
import { Tree, TreeParent, TreeChildren, treeEntityRegistry } from '../../src/tree/tree-decorator.js';
import { TreeManager } from '../../src/tree/tree-manager.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { createSqliteExecutor, type SqliteClientLike } from '../../src/core/execution/executors/sqlite-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';

// Helper to create SQLite client from sqlite3.Database
const createSqliteClient = (db: sqlite3.Database): SqliteClientLike => ({
  all(sql, params) {
    return new Promise((resolve, reject) => {
      db.all(sql, params ?? [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows as Record<string, unknown>[]);
      });
    });
  }
});

// Helper to create ORM session from sqlite3.Database
const createSessionFromDb = (db: sqlite3.Database): OrmSession => {
  const executor = createSqliteExecutor(createSqliteClient(db));
  const orm = new Orm({
    dialect: new SqliteDialect(),
    executorFactory: {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    }
  });
  return new OrmSession({ orm, executor });
};

/**
 * Category entity with tree behavior using default configuration.
 * 
 * Tree structure:
 * - Electronics (root)
 *   - Computers
 *     - Laptops
 *     - Desktops
 *   - Phones
 *     - Smartphones
 *     - Tablets
 * - Clothing (root)
 *   - Men
 *   - Women
 */
@Entity({ tableName: 'categories' })
@Tree()
class Category {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @Column(col.int())
  parentId?: number | null;

  @Column(col.int())
  lft!: number;

  @Column(col.int())
  rght!: number;

  @TreeParent()
  parent?: Category;

  @TreeChildren()
  children?: Category[];
}

/**
 * Comment entity with tree behavior using custom configuration.
 * Uses custom column names and depth tracking.
 */
@Entity({ tableName: 'comments' })
@Tree({
  parentKey: 'parent_id',
  leftKey: 'left_bound',
  rightKey: 'right_bound',
  depthKey: 'depth_level',
  cascadeCallbacks: true,
})
class Comment {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.text())
  content!: string;

  @Column(col.int())
  parent_id?: number | null;

  @Column(col.int())
  left_bound!: number;

  @Column(col.int())
  right_bound!: number;

  @Column(col.int())
  depth_level!: number;

  @TreeParent()
  parent?: Comment;

  @TreeChildren()
  children?: Comment[];
}

/**
 * Menu entity with tree behavior and scope.
 * Uses scope to support multiple menus in one table.
 */
@Entity({ tableName: 'menu_items' })
@Tree({
  parentKey: 'parentId',
  leftKey: 'lft',
  rightKey: 'rght',
  depthKey: 'level',
  scope: ['menuType'],
})
class MenuItem {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  label!: string;

  @Column(col.varchar(50))
  menuType!: string;

  @Column(col.int())
  parentId?: number | null;

  @Column(col.int())
  lft!: number;

  @Column(col.int())
  rght!: number;

  @Column(col.int())
  level!: number;

  @TreeParent()
  parent?: MenuItem;

  @TreeChildren()
  children?: MenuItem[];
}

describe('Tree Decorator E2E - SQLite In-Memory', () => {
  beforeEach(() => {
    // Clear registry before each test
    treeEntityRegistry.clear();
  });

  describe('Category Tree - Default Configuration', () => {
    it('should create table schema and insert tree nodes', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const tables = bootstrapEntities();
        const categoryTable = getTableDefFromEntity(Category);
        expect(categoryTable).toBeDefined();
        expect(categoryTable!.name).toBe('categories');

        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Insert root nodes
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Electronics', null, 1, 12]
        );
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Clothing', null, 13, 16]
        );

        // Insert children of Electronics
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Computers', 1, 2, 7]
        );
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Phones', 1, 8, 11]
        );

        // Insert children of Computers
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Laptops', 3, 3, 4]
        );
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Desktops', 3, 5, 6]
        );

        // Insert children of Phones
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Smartphones', 4, 9, 10]
        );

        // Insert children of Clothing
        await runSql(
          db,
          'INSERT INTO categories (name, parentId, lft, rght) VALUES (?, ?, ?, ?);',
          ['Men', 2, 14, 15]
        );

        // Verify tree structure using TreeManager
        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Get root nodes
        const roots = await manager.getRoots();
        expect(roots).toHaveLength(2);
        expect(roots[0].data.name).toBe('Electronics');
        expect(roots[1].data.name).toBe('Clothing');

        // Get children of Electronics
        const electronicsChildren = await manager.getChildren(1);
        expect(electronicsChildren).toHaveLength(2);
        expect(electronicsChildren[0].data.name).toBe('Computers');
        expect(electronicsChildren[1].data.name).toBe('Phones');

        // Get descendants of Electronics
        const electronicsDescendants = await manager.getDescendants(roots[0]);
        expect(electronicsDescendants).toHaveLength(5);
        const names = electronicsDescendants.map(n => n.data.name);
        expect(names).toContain('Computers');
        expect(names).toContain('Phones');
        expect(names).toContain('Laptops');
        expect(names).toContain('Desktops');
        expect(names).toContain('Smartphones');

        // Get path to Laptops
        const laptops = await manager.getNode(5);
        expect(laptops).toBeDefined();
        expect(laptops!.data.name).toBe('Laptops');

        const path = await manager.getPath(laptops!);
        expect(path).toHaveLength(3);
        expect(path[0].data.name).toBe('Electronics');
        expect(path[1].data.name).toBe('Computers');
        expect(path[2].data.name).toBe('Laptops');

        // Get siblings
        const laptopsSiblings = await manager.getSiblings(laptops!);
        expect(laptopsSiblings).toHaveLength(2);
        expect(laptopsSiblings.map(s => s.data.name)).toContain('Laptops');
        expect(laptopsSiblings.map(s => s.data.name)).toContain('Desktops');

        // Verify node properties
        expect(laptops!.isLeaf).toBe(true);
        expect(laptops!.isRoot).toBe(false);
        expect(laptops!.childCount).toBe(0);

        const electronics = roots[0];
        expect(electronics.isRoot).toBe(true);
        expect(electronics.isLeaf).toBe(false);
        expect(electronics.childCount).toBe(5);
      } finally {
        await closeDb(db);
      }
    });

    it('should insert new nodes using TreeManager', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Insert root node
        const rootId = await manager.insertAsChild(null, { name: 'Root Category' });
        expect(rootId).toBeDefined();

        // Insert child
        const childId = await manager.insertAsChild(rootId, { name: 'Child Category' });
        expect(childId).toBeDefined();

        // Insert grandchild
        const grandchildId = await manager.insertAsChild(childId, { name: 'Grandchild Category' });
        expect(grandchildId).toBeDefined();

        // Verify structure
        const roots = await manager.getRoots();
        expect(roots).toHaveLength(1);
        expect(roots[0].data.name).toBe('Root Category');

        const children = await manager.getChildren(rootId);
        expect(children).toHaveLength(1);
        expect(children[0].data.name).toBe('Child Category');

        const grandchildren = await manager.getChildren(childId);
        expect(grandchildren).toHaveLength(1);
        expect(grandchildren[0].data.name).toBe('Grandchild Category');
      } finally {
        await closeDb(db);
      }
    });

    it('should move nodes within the tree', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Setup initial tree
        await execSql(db, `
          INSERT INTO categories (name, parentId, lft, rght) VALUES
          ('Root', NULL, 1, 10),
          ('Child1', 1, 2, 5),
          ('Child2', 1, 6, 9),
          ('Grandchild1', 2, 3, 4),
          ('Grandchild2', 3, 7, 8);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Move Child2 to be a child of Child1
        const child2 = await manager.getNode(3);
        const child1 = await manager.getNode(2);
        await manager.moveTo(child2!, 2);

        // Verify new structure
        const child1Children = await manager.getChildren(2);
        expect(child1Children).toHaveLength(2);
        expect(child1Children.map(c => c.data.name)).toContain('Grandchild1');
        expect(child1Children.map(c => c.data.name)).toContain('Child2');

        const rootChildren = await manager.getChildren(1);
        expect(rootChildren).toHaveLength(1);
        expect(rootChildren[0].data.name).toBe('Child1');
      } finally {
        await closeDb(db);
      }
    });

    it('should delete subtree', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Setup tree
        await execSql(db, `
          INSERT INTO categories (name, parentId, lft, rght) VALUES
          ('Root', NULL, 1, 10),
          ('Child1', 1, 2, 5),
          ('Child2', 1, 6, 9),
          ('Grandchild1', 2, 3, 4),
          ('Grandchild2', 3, 7, 8);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Delete Child1 subtree (includes Grandchild1)
        const child1 = await manager.getNode(2);
        const deletedCount = await manager.deleteSubtree(child1!);
        expect(deletedCount).toBe(2); // Child1 and Grandchild1

        // Verify remaining nodes
        const roots = await manager.getRoots();
        expect(roots).toHaveLength(1);

        const rootChildren = await manager.getChildren(1);
        expect(rootChildren).toHaveLength(1);
        expect(rootChildren[0].data.name).toBe('Child2');
      } finally {
        await closeDb(db);
      }
    });

    it('should validate tree structure', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Setup valid tree
        await execSql(db, `
          INSERT INTO categories (name, parentId, lft, rght) VALUES
          ('Root', NULL, 1, 6),
          ('Child1', 1, 2, 3),
          ('Child2', 1, 4, 5);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Validate valid tree
        const errors = await manager.validate();
        expect(errors).toHaveLength(0);

        // Corrupt the tree
        await execSql(db, `UPDATE categories SET lft = 10 WHERE id = 2`);

        // Validate corrupted tree
        const corruptedErrors = await manager.validate();
        expect(corruptedErrors.length).toBeGreaterThan(0);
      } finally {
        await closeDb(db);
      }
    });

    it('should recover corrupted tree', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Setup tree with corrupted nested set values
        await execSql(db, `
          INSERT INTO categories (name, parentId, lft, rght) VALUES
          ('Root', NULL, 100, 200),
          ('Child1', 1, 50, 60),
          ('Child2', 1, 70, 80),
          ('Grandchild1', 2, 10, 20);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        // Recover tree
        const result = await manager.recover();
        expect(result.success).toBe(true);
        expect(result.processed).toBe(4);

        // Verify recovered structure
        const roots = await manager.getRoots();
        expect(roots).toHaveLength(1);
        expect(roots[0].lft).toBe(1);
        expect(roots[0].rght).toBe(8);

        const children = await manager.getChildren(1);
        expect(children).toHaveLength(2);
      } finally {
        await closeDb(db);
      }
    });

    it('should get threaded descendants', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const categoryTable = getTableDefFromEntity(Category);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          categoryTable!
        );

        // Setup tree
        await execSql(db, `
          INSERT INTO categories (name, parentId, lft, rght) VALUES
          ('Root', NULL, 1, 10),
          ('Child1', 1, 2, 7),
          ('Child2', 1, 8, 9),
          ('Grandchild1', 2, 3, 4),
          ('Grandchild2', 2, 5, 6);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: categoryTable!,
        });

        const root = await manager.getNode(1);
        const threaded = await manager.getDescendantsThreaded(root!);

        expect(threaded).toHaveLength(2);
        expect(threaded[0].node.name).toBe('Child1');
        expect(threaded[0].children).toHaveLength(2);
        expect(threaded[0].children[0].node.name).toBe('Grandchild1');
        expect(threaded[0].children[1].node.name).toBe('Grandchild2');
        expect(threaded[1].node.name).toBe('Child2');
        expect(threaded[1].children).toHaveLength(0);
      } finally {
        await closeDb(db);
      }
    });
  });

  describe('Comment Tree - Custom Configuration', () => {
    it('should work with custom column names', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const commentTable = getTableDefFromEntity(Comment);
        expect(commentTable).toBeDefined();
        expect(commentTable!.name).toBe('comments');

        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          commentTable!
        );

        // Setup comment tree
        await execSql(db, `
          INSERT INTO comments (content, parent_id, left_bound, right_bound, depth_level) VALUES
          ('Main post', NULL, 1, 10, 0),
          ('Reply 1', 1, 2, 5, 1),
          ('Reply 2', 1, 6, 9, 1),
          ('Reply to Reply 1', 2, 3, 4, 2),
          ('Reply to Reply 2', 3, 7, 8, 2);
        `);

        const manager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: commentTable!,
          config: {
            parentKey: 'parent_id',
            leftKey: 'left_bound',
            rightKey: 'right_bound',
            depthKey: 'depth_level',
          },
        });

        // Get root comment
        const roots = await manager.getRoots();
        expect(roots).toHaveLength(1);
        expect(roots[0].data.content).toBe('Main post');
        expect(roots[0].depth).toBe(0);

        // Get replies
        const replies = await manager.getChildren(1);
        expect(replies).toHaveLength(2);
        expect(replies[0].depth).toBe(1);
        expect(replies[1].depth).toBe(1);

        // Get nested reply
        const nestedReply = await manager.getNode(4);
        expect(nestedReply).toBeDefined();
        expect(nestedReply!.depth).toBe(2);
      } finally {
        await closeDb(db);
      }
    });
  });

  describe('MenuItem Tree - Scoped Trees', () => {
    it('should handle multiple scoped trees in one table', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const menuItemTable = getTableDefFromEntity(MenuItem);
        expect(menuItemTable).toBeDefined();
        expect(menuItemTable!.name).toBe('menu_items');

        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          menuItemTable!
        );

        // Setup main menu
        await execSql(db, `
          INSERT INTO menu_items (label, menuType, parentId, lft, rght, level) VALUES
          ('Home', 'main', NULL, 1, 8, 0),
          ('About', 'main', 1, 2, 5, 1),
          ('Contact', 'main', 1, 6, 7, 1),
          ('Team', 'main', 2, 3, 4, 2);
        `);

        // Setup footer menu
        await execSql(db, `
          INSERT INTO menu_items (label, menuType, parentId, lft, rght, level) VALUES
          ('Privacy', 'footer', NULL, 1, 6, 0),
          ('Terms', 'footer', 5, 2, 3, 1),
          ('Cookies', 'footer', 5, 4, 5, 1);
        `);

        // Create manager for main menu
        const mainMenuManager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: menuItemTable!,
          config: {
            parentKey: 'parentId',
            leftKey: 'lft',
            rightKey: 'rght',
            depthKey: 'level',
            scope: ['menuType'],
          },
          scope: { menuType: 'main' },
        });

        // Create manager for footer menu
        const footerMenuManager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: menuItemTable!,
          config: {
            parentKey: 'parentId',
            leftKey: 'lft',
            rightKey: 'rght',
            depthKey: 'level',
            scope: ['menuType'],
          },
          scope: { menuType: 'footer' },
        });

        // Get main menu roots
        const mainRoots = await mainMenuManager.getRoots();
        expect(mainRoots).toHaveLength(1);
        expect(mainRoots[0].data.label).toBe('Home');

        // Get footer menu roots
        const footerRoots = await footerMenuManager.getRoots();
        expect(footerRoots).toHaveLength(1);
        expect(footerRoots[0].data.label).toBe('Privacy');

        // Verify main menu children
        const mainChildren = await mainMenuManager.getChildren(1);
        expect(mainChildren).toHaveLength(2);
        expect(mainChildren.map(c => c.data.label)).toContain('About');
        expect(mainChildren.map(c => c.data.label)).toContain('Contact');

        // Verify footer menu children
        const footerChildren = await footerMenuManager.getChildren(5);
        expect(footerChildren).toHaveLength(2);
        expect(footerChildren.map(c => c.data.label)).toContain('Terms');
        expect(footerChildren.map(c => c.data.label)).toContain('Cookies');
      } finally {
        await closeDb(db);
      }
    });

    it('should use withScope to create scoped manager', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        const menuItemTable = getTableDefFromEntity(MenuItem);
        const session = createSessionFromDb(db);
        await executeSchemaSqlFor(
          session.executor,
          new SQLiteSchemaDialect(),
          menuItemTable!
        );

        // Setup menus
        await execSql(db, `
          INSERT INTO menu_items (label, menuType, parentId, lft, rght, level) VALUES
          ('Home', 'main', NULL, 1, 2, 0),
          ('Privacy', 'footer', NULL, 1, 2, 0);
        `);

        // Create base manager
        const baseManager = new TreeManager({
          executor: session.executor,
          dialect: session.dialect,
          table: menuItemTable!,
          config: {
            parentKey: 'parentId',
            leftKey: 'lft',
            rightKey: 'rght',
            depthKey: 'level',
            scope: ['menuType'],
          },
        });

        // Create scoped managers
        const mainMenuManager = baseManager.withScope({ menuType: 'main' });
        const footerMenuManager = baseManager.withScope({ menuType: 'footer' });

        // Verify each scope sees only its own items
        const mainRoots = await mainMenuManager.getRoots();
        expect(mainRoots).toHaveLength(1);
        expect(mainRoots[0].data.label).toBe('Home');

        const footerRoots = await footerMenuManager.getRoots();
        expect(footerRoots).toHaveLength(1);
        expect(footerRoots[0].data.label).toBe('Privacy');
      } finally {
        await closeDb(db);
      }
    });
  });

  describe('Tree Decorator Metadata', () => {
    it('should register tree entities in the registry', async () => {
      const db = new sqlite3.Database(':memory:');

      try {
        bootstrapEntities();

        // Register entities with table names
        const categoryTable = getTableDefFromEntity(Category);
        const commentTable = getTableDefFromEntity(Comment);
        const menuItemTable = getTableDefFromEntity(MenuItem);

        treeEntityRegistry.register(Category, categoryTable!.name);
        treeEntityRegistry.register(Comment, commentTable!.name);
        treeEntityRegistry.register(MenuItem, menuItemTable!.name);

        // Verify registration
        expect(treeEntityRegistry.isTreeTable('categories')).toBe(true);
        expect(treeEntityRegistry.isTreeTable('comments')).toBe(true);
        expect(treeEntityRegistry.isTreeTable('menu_items')).toBe(true);
        expect(treeEntityRegistry.isTreeTable('non_existent')).toBe(false);

        // Get all registered tree entities
        const allTrees = treeEntityRegistry.getAll();
        expect(allTrees).toHaveLength(3);
        expect(allTrees.map(t => t.tableName)).toContain('categories');
        expect(allTrees.map(t => t.tableName)).toContain('comments');
        expect(allTrees.map(t => t.tableName)).toContain('menu_items');
      } finally {
        await closeDb(db);
      }
    });
  });
});
