/**
 * Phase 4: Tree Decorator Tests
 * 
 * Tests for Level 3 API: Decorator-based tree configuration for entity classes.
 * Covers @Tree(), @TreeParent(), @TreeChildren() decorators and helper functions.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  Tree,
  TreeParent,
  TreeChildren,
  getTreeMetadata,
  setTreeMetadata,
  hasTreeBehavior,
  getTreeConfig,
  getTreeBounds,
  getTreeParentId,
  setTreeBounds,
  setTreeParentId,
  treeEntityRegistry,
  type TreeMetadata,
} from '../../src/tree/tree-decorator.js';
import type { TreeConfig } from '../../src/tree/tree-types.js';

// Helper decorators for testing (simulating MetalORM's @Entity and @Column)
function Entity() {
  return function <T extends abstract new (...args: unknown[]) => object>(
    target: T,
    _context: ClassDecoratorContext<T>
  ): T {
    return target;
  };
}

function PrimaryKey() {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext<object, unknown>
  ): void {
    context.addInitializer(function () {
      // Initialization handled by MetalORM runtime
    });
  };
}

function Column(_options?: { nullable?: boolean }) {
  return function (
    _value: undefined,
    context: ClassFieldDecoratorContext<object, unknown>
  ): void {
    context.addInitializer(function () {
      // Initialization handled by MetalORM runtime
    });
  };
}

// Test entity class for @Tree() decorator with basic options
@Entity()
@Tree()
class SimpleTreeEntity {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  parentId!: number | null;

  @Column()
  lft!: number;

  @Column()
  rght!: number;

  @TreeParent()
  parent?: SimpleTreeEntity;

  @TreeChildren()
  children?: SimpleTreeEntity[];
}

// Test entity class for @Tree() decorator with custom keys
@Entity()
@Tree({
  parentKey: 'parent_id',
  leftKey: 'left_bound',
  rightKey: 'right_bound',
  depthKey: 'level',
  scope: ['tenantId'],
  cascadeCallbacks: true,
  recoverOrder: { name: 'ASC' },
})
class CustomKeysTreeEntity {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  parent_id!: number | null;

  @Column()
  left_bound!: number;

  @Column()
  right_bound!: number;

  @Column()
  level!: number;

  @Column()
  tenantId!: string;

  @TreeParent()
  parent?: CustomKeysTreeEntity;

  @TreeChildren()
  children?: CustomKeysTreeEntity[];
}

// Test entity class for cascadeCallbacks option
@Entity()
@Tree({ cascadeCallbacks: true })
class CascadeCallbacksEntity {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  parentId!: number | null;

  @Column()
  lft!: number;

  @Column()
  rght!: number;

  @TreeParent()
  parent?: CascadeCallbacksEntity;

  @TreeChildren()
  children?: CascadeCallbacksEntity[];
}

// Test entity class for recoverOrder option
@Entity()
@Tree({ recoverOrder: { name: 'ASC', createdAt: 'DESC' } })
class RecoverOrderEntity {
  @PrimaryKey()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  parentId!: number | null;

  @Column()
  lft!: number;

  @Column()
  rght!: number;

  @Column()
  createdAt!: Date;

  @TreeParent()
  parent?: RecoverOrderEntity;

  @TreeChildren()
  children?: RecoverOrderEntity[];
}

describe('Tree Decorator', () => {
  beforeEach(() => {
    // Clear registry before each test
    treeEntityRegistry.clear();
  });

  describe('@Tree() - basic options', () => {
    it('should apply decorator with default options', () => {
      expect(hasTreeBehavior(SimpleTreeEntity)).toBe(true);
    });

    it('should have correct default configuration', () => {
      const config = getTreeConfig(SimpleTreeEntity);
      expect(config).toBeDefined();
      expect(config!.parentKey).toBe('parentId');
      expect(config!.leftKey).toBe('lft');
      expect(config!.rightKey).toBe('rght');
      expect(config!.depthKey).toBeUndefined();
      expect(config!.scope).toBeUndefined();
      expect(config!.cascadeCallbacks).toBe(false);
      expect(config!.recoverOrder).toBeUndefined();
    });

    it('should apply custom configuration options', () => {
      expect(hasTreeBehavior(CustomKeysTreeEntity)).toBe(true);

      const config = getTreeConfig(CustomKeysTreeEntity);
      expect(config).toBeDefined();
      expect(config!.parentKey).toBe('parent_id');
      expect(config!.leftKey).toBe('left_bound');
      expect(config!.rightKey).toBe('right_bound');
      expect(config!.depthKey).toBe('level');
      expect(config!.scope).toEqual(['tenantId']);
      expect(config!.cascadeCallbacks).toBe(true);
      expect(config!.recoverOrder).toEqual({ name: 'ASC' });
    });

    it('should support cascadeCallbacks option', () => {
      const config = getTreeConfig(CascadeCallbacksEntity);
      expect(config!.cascadeCallbacks).toBe(true);
    });

    it('should support recoverOrder option', () => {
      const config = getTreeConfig(RecoverOrderEntity);
      expect(config!.recoverOrder).toEqual({ name: 'ASC', createdAt: 'DESC' });
    });

    it('should allow empty options object', () => {
      @Entity()
      @Tree({})
      class EmptyOptionsEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      expect(hasTreeBehavior(EmptyOptionsEntity)).toBe(true);
      const config = getTreeConfig(EmptyOptionsEntity);
      expect(config!.parentKey).toBe('parentId');
      expect(config!.leftKey).toBe('lft');
      expect(config!.rightKey).toBe('rght');
    });
  });

  describe('@TreeParent() decorator', () => {
    it('should mark field as parent relation', () => {
      // Create actual instance to trigger field initializer
      const entity = new SimpleTreeEntity();
      
      const metadata = getTreeMetadata(SimpleTreeEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.parentProperty).toBe('parent');
    });

    it('should mark field as parent relation for custom keys entity', () => {
      const entity = new CustomKeysTreeEntity();
      
      const metadata = getTreeMetadata(CustomKeysTreeEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.parentProperty).toBe('parent');
    });
  });

  describe('@TreeChildren() decorator', () => {
    it('should mark field as children relation', () => {
      // Create actual instance to trigger field initializer
      const entity = new SimpleTreeEntity();
      
      const metadata = getTreeMetadata(SimpleTreeEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.childrenProperty).toBe('children');
    });

    it('should mark field as children relation for custom keys entity', () => {
      const entity = new CustomKeysTreeEntity();
      
      const metadata = getTreeMetadata(CustomKeysTreeEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.childrenProperty).toBe('children');
    });
  });

  describe('getTreeMetadata()', () => {
    it('should return metadata for tree entity', () => {
      // Create instance to trigger field initializers
      new SimpleTreeEntity();
      
      const metadata = getTreeMetadata(SimpleTreeEntity);
      expect(metadata).toBeDefined();
      expect(metadata!.config).toBeDefined();
      expect(metadata!.config.parentKey).toBe('parentId');
    });

    it('should return undefined for non-tree entity', () => {
      class NonTreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      const metadata = getTreeMetadata(NonTreeEntity);
      expect(metadata).toBeUndefined();
    });
  });

  describe('setTreeMetadata()', () => {
    it('should allow manual metadata update', () => {
      const newMetadata: TreeMetadata = {
        config: {
          parentKey: 'customParent',
          leftKey: 'customLeft',
          rightKey: 'customRight',
          cascadeCallbacks: true,
        },
        parentProperty: 'customParent',
        childrenProperty: 'customChildren',
      };

      // Create a fresh entity class for this test to avoid pollution
      @Entity()
      @Tree()
      class TestEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      setTreeMetadata(TestEntity, newMetadata);
      const metadata = getTreeMetadata(TestEntity);

      expect(metadata!.config.parentKey).toBe('customParent');
      expect(metadata!.parentProperty).toBe('customParent');
      expect(metadata!.childrenProperty).toBe('customChildren');
    });
  });

  describe('hasTreeBehavior()', () => {
    it('should return true for tree entity', () => {
      expect(hasTreeBehavior(SimpleTreeEntity)).toBe(true);
      expect(hasTreeBehavior(CustomKeysTreeEntity)).toBe(true);
    });

    it('should return false for non-tree entity', () => {
      class NonTreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      expect(hasTreeBehavior(NonTreeEntity)).toBe(false);
    });
  });

  describe('getTreeConfig()', () => {
    it('should return full config for tree entity', () => {
      const config = getTreeConfig(SimpleTreeEntity);
      expect(config).toBeDefined();
      expect(config!.parentKey).toBe('parentId');
      expect(config!.leftKey).toBe('lft');
      expect(config!.rightKey).toBe('rght');
    });

    it('should return undefined for non-tree entity', () => {
      class NonTreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      const config = getTreeConfig(NonTreeEntity);
      expect(config).toBeUndefined();
    });
  });
});

describe('Tree Helper Functions', () => {
  describe('getTreeBounds()', () => {
    it('should return bounds when both lft and rght are numbers', () => {
      const entity = {
        lft: 1,
        rght: 10,
      };

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const bounds = getTreeBounds(entity, config);
      expect(bounds).toEqual({ lft: 1, rght: 10 });
    });

    it('should return null when lft is not a number', () => {
      const entity = {
        lft: 'invalid',
        rght: 10,
      };

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const bounds = getTreeBounds(entity, config);
      expect(bounds).toBeNull();
    });

    it('should return null when rght is not a number', () => {
      const entity = {
        lft: 1,
        rght: null,
      };

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const bounds = getTreeBounds(entity, config);
      expect(bounds).toBeNull();
    });

    it('should return null when both are missing', () => {
      const entity = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const bounds = getTreeBounds(entity, config);
      expect(bounds).toBeNull();
    });

    it('should work with custom keys', () => {
      const entity = {
        left_bound: 5,
        right_bound: 15,
      };

      const config: TreeConfig = {
        parentKey: 'parent_id',
        leftKey: 'left_bound',
        rightKey: 'right_bound',
      };

      const bounds = getTreeBounds(entity, config);
      expect(bounds).toEqual({ lft: 5, rght: 15 });
    });
  });

  describe('getTreeParentId()', () => {
    it('should return parent ID from entity', () => {
      const entity = {
        parentId: 42,
      };

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const parentId = getTreeParentId(entity, config);
      expect(parentId).toBe(42);
    });

    it('should return null parent ID', () => {
      const entity = {
        parentId: null,
      };

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const parentId = getTreeParentId(entity, config);
      expect(parentId).toBeNull();
    });

    it('should work with custom parent key', () => {
      const entity = {
        parent_id: 123,
      };

      const config: TreeConfig = {
        parentKey: 'parent_id',
        leftKey: 'left_bound',
        rightKey: 'right_bound',
      };

      const parentId = getTreeParentId(entity, config);
      expect(parentId).toBe(123);
    });

    it('should return undefined for missing parent key', () => {
      const entity = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      const parentId = getTreeParentId(entity, config);
      expect(parentId).toBeUndefined();
    });
  });

  describe('setTreeBounds()', () => {
    it('should set lft and rght values', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      setTreeBounds(entity, config, 5, 20);

      expect(entity.lft).toBe(5);
      expect(entity.rght).toBe(20);
    });

    it('should set depth when depthKey is configured', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        depthKey: 'depth',
      };

      setTreeBounds(entity, config, 5, 20, 2);

      expect(entity.lft).toBe(5);
      expect(entity.rght).toBe(20);
      expect(entity.depth).toBe(2);
    });

    it('should not set depth when depthKey is not configured', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      setTreeBounds(entity, config, 5, 20, 2);

      expect(entity.lft).toBe(5);
      expect(entity.rght).toBe(20);
      expect(entity.depth).toBeUndefined();
    });

    it('should work with custom keys', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parent_id',
        leftKey: 'left_bound',
        rightKey: 'right_bound',
        depthKey: 'level',
      };

      setTreeBounds(entity, config, 10, 25, 3);

      expect(entity.left_bound).toBe(10);
      expect(entity.right_bound).toBe(25);
      expect(entity.level).toBe(3);
    });
  });

  describe('setTreeParentId()', () => {
    it('should set parent ID on entity', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      setTreeParentId(entity, config, 42);

      expect(entity.parentId).toBe(42);
    });

    it('should set null parent ID', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
      };

      setTreeParentId(entity, config, null);

      expect(entity.parentId).toBeNull();
    });

    it('should work with custom parent key', () => {
      const entity: Record<string, unknown> = {};

      const config: TreeConfig = {
        parentKey: 'parent_id',
        leftKey: 'left_bound',
        rightKey: 'right_bound',
      };

      setTreeParentId(entity, config, 123);

      expect(entity.parent_id).toBe(123);
    });
  });
});

describe('TreeEntityRegistry', () => {
  beforeEach(() => {
    // Clear registry before each test
    treeEntityRegistry.clear();
  });

  describe('register()', () => {
    it('should register an entity with table name', () => {
      @Entity()
      @Tree()
      class RegisteredEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(RegisteredEntity, 'registered_entities');

      const retrieved = treeEntityRegistry.getByTableName('registered_entities');
      expect(retrieved).toBe(RegisteredEntity);
    });

    it('should support multiple registrations', () => {
      @Entity()
      @Tree()
      class Entity1 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      @Entity()
      @Tree()
      class Entity2 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(Entity1, 'entity1_table');
      treeEntityRegistry.register(Entity2, 'entity2_table');

      expect(treeEntityRegistry.getByTableName('entity1_table')).toBe(Entity1);
      expect(treeEntityRegistry.getByTableName('entity2_table')).toBe(Entity2);
    });
  });

  describe('getByTableName()', () => {
    it('should return undefined for unregistered table', () => {
      const result = treeEntityRegistry.getByTableName('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return entity for registered table', () => {
      @Entity()
      @Tree()
      class TestEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(TestEntity, 'test_table');

      const result = treeEntityRegistry.getByTableName('test_table');
      expect(result).toBe(TestEntity);
    });
  });

  describe('getTableName()', () => {
    it('should return table name for registered entity', () => {
      @Entity()
      @Tree()
      class TestEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(TestEntity, 'my_table');

      const tableName = treeEntityRegistry.getTableName(TestEntity);
      expect(tableName).toBe('my_table');
    });

    it('should return undefined for unregistered entity', () => {
      class UnregisteredEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      const tableName = treeEntityRegistry.getTableName(UnregisteredEntity);
      expect(tableName).toBeUndefined();
    });
  });

  describe('isTreeTable()', () => {
    it('should return true for registered tree table', () => {
      @Entity()
      @Tree()
      class TreeTableEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(TreeTableEntity, 'tree_table');

      expect(treeEntityRegistry.isTreeTable('tree_table')).toBe(true);
    });

    it('should return false for unregistered table', () => {
      expect(treeEntityRegistry.isTreeTable('nonexistent')).toBe(false);
    });

    it('should return false for table without tree behavior', () => {
      @Entity()
      class NonTreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      // Note: NonTreeEntity doesn't have @Tree decorator, so it won't have tree behavior
      // But we can still register it to test the behavior check
      treeEntityRegistry.register(NonTreeEntity, 'non_tree_table');

      expect(treeEntityRegistry.isTreeTable('non_tree_table')).toBe(false);
    });
  });

  describe('getAll()', () => {
    it('should return empty array for empty registry', () => {
      const all = treeEntityRegistry.getAll();
      expect(all).toEqual([]);
    });

    it('should return all registered tree entities', () => {
      @Entity()
      @Tree()
      class Entity1 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      @Entity()
      @Tree()
      class Entity2 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(Entity1, 'table1');
      treeEntityRegistry.register(Entity2, 'table2');

      const all = treeEntityRegistry.getAll();

      expect(all).toHaveLength(2);
      expect(all.map(e => e.tableName)).toContain('table1');
      expect(all.map(e => e.tableName)).toContain('table2');
      expect(all.map(e => e.entityClass)).toContain(Entity1);
      expect(all.map(e => e.entityClass)).toContain(Entity2);
      expect(all[0].metadata).toBeDefined();
    });

    it('should only return entities with tree metadata', () => {
      @Entity()
      @Tree()
      class TreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      @Entity()
      class NonTreeEntity {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;
      }

      treeEntityRegistry.register(TreeEntity, 'tree_table');
      treeEntityRegistry.register(NonTreeEntity, 'non_tree_table');

      const all = treeEntityRegistry.getAll();

      // Should only return tree entity
      expect(all).toHaveLength(1);
      expect(all[0].entityClass).toBe(TreeEntity);
    });
  });

  describe('clear()', () => {
    it('should clear all registrations', () => {
      @Entity()
      @Tree()
      class Entity1 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      @Entity()
      @Tree()
      class Entity2 {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;
      }

      treeEntityRegistry.register(Entity1, 'table1');
      treeEntityRegistry.register(Entity2, 'table2');

      expect(treeEntityRegistry.getAll()).toHaveLength(2);

      treeEntityRegistry.clear();

      expect(treeEntityRegistry.getAll()).toEqual([]);
      expect(treeEntityRegistry.getByTableName('table1')).toBeUndefined();
      expect(treeEntityRegistry.getByTableName('table2')).toBeUndefined();
    });
  });

  describe('Integration: Full Tree Setup', () => {
    it('should support complete tree entity setup with all decorators', () => {
      // Clear first
      treeEntityRegistry.clear();

      @Entity()
      @Tree({
        parentKey: 'parentId',
        leftKey: 'lft',
        rightKey: 'rght',
        depthKey: 'depth',
        scope: ['tenantId'],
        cascadeCallbacks: true,
      })
      class Category {
        @PrimaryKey()
        id!: number;

        @Column()
        name!: string;

        @Column({ nullable: true })
        parentId!: number | null;

        @Column()
        lft!: number;

        @Column()
        rght!: number;

        @Column()
        depth!: number;

        @Column()
        tenantId!: string;

        @TreeParent()
        parent?: Category;

        @TreeChildren()
        children?: Category[];
      }

      // Register
      treeEntityRegistry.register(Category, 'categories');

      // Verify registry
      expect(treeEntityRegistry.isTreeTable('categories')).toBe(true);
      expect(treeEntityRegistry.getTableName(Category)).toBe('categories');

      // Verify decorator config
      const config = getTreeConfig(Category);
      expect(config!.parentKey).toBe('parentId');
      expect(config!.leftKey).toBe('lft');
      expect(config!.rightKey).toBe('rght');
      expect(config!.depthKey).toBe('depth');
      expect(config!.scope).toEqual(['tenantId']);
      expect(config!.cascadeCallbacks).toBe(true);

      // Create instance to trigger field initializers
      const category = new Category();
      // Set tree values for testing
      category.lft = 1;
      category.rght = 10;
      category.parentId = null;
      
      // Verify metadata with parent/children properties
      const metadata = getTreeMetadata(Category);
      expect(metadata!.parentProperty).toBe('parent');
      expect(metadata!.childrenProperty).toBe('children');

      // Verify helper functions
      const bounds = getTreeBounds(category, config!);
      expect(bounds).toEqual({ lft: 1, rght: 10 });

      const parentId = getTreeParentId(category, config!);
      expect(parentId).toBeNull();

      // Verify set helpers
      setTreeBounds(category, config!, 5, 20, 2);
      expect(category.lft).toBe(5);
      expect(category.rght).toBe(20);
      expect(category.depth).toBe(2);

      setTreeParentId(category, config!, 42);
      expect(category.parentId).toBe(42);
    });
  });
});
