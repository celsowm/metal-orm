/**
 * Tree Decorators
 * 
 * Level 3 API: Decorator-based tree configuration for entity classes.
 * Integrates with MetalORM's decorator entity system.
 */

import type { TreeConfig } from './tree-types.js';
import { resolveTreeConfig } from './tree-types.js';

/**
 * Symbol key for storing tree metadata on entity classes.
 */
const TREE_METADATA_KEY = Symbol('metal-orm:tree');

/**
 * Stored tree metadata for an entity class.
 */
export interface TreeMetadata {
  config: TreeConfig;
  parentProperty?: string;
  childrenProperty?: string;
}

/**
 * Options for the @Tree decorator.
 */
export interface TreeDecoratorOptions {
  /** Column name for parent reference (default: 'parentId') */
  parentKey?: string;
  /** Column name for left boundary (default: 'lft') */
  leftKey?: string;
  /** Column name for right boundary (default: 'rght') */
  rightKey?: string;
  /** Optional column name for cached depth level */
  depthKey?: string;
  /** Columns used for scoping multiple trees in one table */
  scope?: string[];
  /** Whether to load and delete children individually to trigger hooks */
  cascadeCallbacks?: boolean;
  /** Custom ordering for tree recovery */
  recoverOrder?: Record<string, 'ASC' | 'DESC'>;
}

/**
 * Decorator to mark an entity class as a tree/hierarchical entity.
 * 
 * @example
 * ```ts
 * @Entity()
 * @Tree({ parentKey: 'parentId', leftKey: 'lft', rightKey: 'rght' })
 * class Category {
 *   @PrimaryKey(col.int())
 *   id!: number;
 * 
 *   @Column(col.varchar(255))
 *   name!: string;
 * 
 *   @Column(col.int().nullable())
 *   parentId!: number | null;
 * 
 *   @Column(col.int())
 *   lft!: number;
 * 
 *   @Column(col.int())
 *   rght!: number;
 * 
 *   @TreeParent()
 *   parent?: Category;
 * 
 *   @TreeChildren()
 *   children?: Category[];
 * }
 * ```
 */
export function Tree(options: TreeDecoratorOptions = {}) {
  return function <T extends abstract new (...args: unknown[]) => object>(
    target: T
  ): T {
    const config = resolveTreeConfig(options);
    const metadata: TreeMetadata = { config };
    
    setTreeMetadataOnClass(target, metadata);
    
    return target;
  };
}

/**
 * Decorator to mark a property as the parent relation in a tree entity.
 * 
 * @example
 * ```ts
 * @TreeParent()
 * parent?: Category;
 * ```
 */
export function TreeParent() {
  return function <T, V>(
    _value: undefined,
    context: ClassFieldDecoratorContext<T, V>
  ): void {
    const propertyName = String(context.name);
    
    context.addInitializer(function (this: T) {
      const constructor = (this as object).constructor as new (...args: unknown[]) => object;
      const metadata = getTreeMetadata(constructor);
      if (metadata) {
        metadata.parentProperty = propertyName;
        setTreeMetadata(constructor, metadata);
      }
    });
  };
}

/**
 * Decorator to mark a property as the children relation in a tree entity.
 * 
 * @example
 * ```ts
 * @TreeChildren()
 * children?: Category[];
 * ```
 */
export function TreeChildren() {
  return function <T, V>(
    _value: undefined,
    context: ClassFieldDecoratorContext<T, V>
  ): void {
    const propertyName = String(context.name);
    
    context.addInitializer(function (this: T) {
      const constructor = (this as object).constructor as new (...args: unknown[]) => object;
      const metadata = getTreeMetadata(constructor);
      if (metadata) {
        metadata.childrenProperty = propertyName;
        setTreeMetadata(constructor, metadata);
      }
    });
  };
}

/**
 * Gets tree metadata from an entity class.
 */
export function getTreeMetadata(
  target: new (...args: unknown[]) => object
): TreeMetadata | undefined {
  return (target as unknown as Record<symbol, TreeMetadata>)[TREE_METADATA_KEY];
}

/**
 * Sets tree metadata on an entity class.
 */
export function setTreeMetadata(
  target: new (...args: unknown[]) => object,
  metadata: TreeMetadata
): void {
  (target as unknown as Record<symbol, TreeMetadata>)[TREE_METADATA_KEY] = metadata;
}

/**
 * Sets tree metadata on an entity class (internal, handles abstract classes).
 */
function setTreeMetadataOnClass(
  target: abstract new (...args: unknown[]) => object,
  metadata: TreeMetadata
): void {
  (target as unknown as Record<symbol, TreeMetadata>)[TREE_METADATA_KEY] = metadata;
}

/**
 * Checks if an entity class has tree behavior configured.
 */
export function hasTreeBehavior(
  target: new (...args: unknown[]) => object
): boolean {
  return getTreeMetadata(target) !== undefined;
}

/**
 * Gets the tree configuration from an entity class.
 */
export function getTreeConfig(
  target: new (...args: unknown[]) => object
): TreeConfig | undefined {
  return getTreeMetadata(target)?.config;
}

/**
 * Registry for tree-enabled entity classes.
 * Allows looking up tree configuration by table name.
 */
class TreeEntityRegistry {
  private entities = new Map<string, new (...args: unknown[]) => object>();
  private tableNames = new Map<new (...args: unknown[]) => object, string>();

  /**
   * Registers an entity class with its table name.
   */
  register(
    entityClass: new (...args: unknown[]) => object,
    tableName: string
  ): void {
    this.entities.set(tableName, entityClass);
    this.tableNames.set(entityClass, tableName);
  }

  /**
   * Gets the entity class for a table name.
   */
  getByTableName(tableName: string): (new (...args: unknown[]) => object) | undefined {
    return this.entities.get(tableName);
  }

  /**
   * Gets the table name for an entity class.
   */
  getTableName(entityClass: new (...args: unknown[]) => object): string | undefined {
    return this.tableNames.get(entityClass);
  }

  /**
   * Checks if a table has tree behavior.
   */
  isTreeTable(tableName: string): boolean {
    const entity = this.entities.get(tableName);
    return entity ? hasTreeBehavior(entity) : false;
  }

  /**
   * Gets all registered tree entities.
   */
  getAll(): Array<{
    entityClass: new (...args: unknown[]) => object;
    tableName: string;
    metadata: TreeMetadata;
  }> {
    const result: Array<{
      entityClass: new (...args: unknown[]) => object;
      tableName: string;
      metadata: TreeMetadata;
    }> = [];

    for (const [tableName, entityClass] of this.entities) {
      const metadata = getTreeMetadata(entityClass);
      if (metadata) {
        result.push({ entityClass, tableName, metadata });
      }
    }

    return result;
  }

  /**
   * Clears the registry.
   */
  clear(): void {
    this.entities.clear();
    this.tableNames.clear();
  }
}

/**
 * Global registry for tree entities.
 */
export const treeEntityRegistry = new TreeEntityRegistry();

/**
 * Helper to get tree bounds from an entity instance.
 */
export function getTreeBounds(
  entity: object,
  config: TreeConfig
): { lft: number; rght: number } | null {
  const data = entity as Record<string, unknown>;
  const lft = data[config.leftKey];
  const rght = data[config.rightKey];

  if (typeof lft !== 'number' || typeof rght !== 'number') {
    return null;
  }

  return { lft, rght };
}

/**
 * Helper to get parent ID from an entity instance.
 */
export function getTreeParentId(
  entity: object,
  config: TreeConfig
): unknown {
  return (entity as Record<string, unknown>)[config.parentKey];
}

/**
 * Helper to set tree bounds on an entity instance.
 */
export function setTreeBounds(
  entity: object,
  config: TreeConfig,
  lft: number,
  rght: number,
  depth?: number
): void {
  const data = entity as Record<string, unknown>;
  data[config.leftKey] = lft;
  data[config.rightKey] = rght;
  if (config.depthKey && depth !== undefined) {
    data[config.depthKey] = depth;
  }
}

/**
 * Helper to set parent ID on an entity instance.
 */
export function setTreeParentId(
  entity: object,
  config: TreeConfig,
  parentId: unknown
): void {
  (entity as Record<string, unknown>)[config.parentKey] = parentId;
}
