import { HasManyCollection } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { HasManyRelation } from '../../schema/relation.js';
import { TableDef } from '../../schema/table.js';
import { EntityMeta, getHydrationRows } from '../entity-meta.js';

type Rows = Record<string, unknown>[];

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const hideInternal = (obj: object, keys: string[]): void => {
  for (const key of keys) {
    Object.defineProperty(obj, key, {
      value: obj[key],
      writable: false,
      configurable: false,
      enumerable: false
    });
  }
};

const hideWritable = (obj: object, keys: string[]): void => {
  for (const key of keys) {
    const value = obj[key as keyof typeof obj];
    Object.defineProperty(obj, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: false
    });
  }
};

/**
 * Default implementation of HasManyCollection for managing one-to-many relationships.
 * @template TChild - The type of child entities in the collection
 */
export class DefaultHasManyCollection<TChild> implements HasManyCollection<TChild> {
  private loaded = false;
  private items: TChild[] = [];
  private readonly added = new Set<TChild>();
  private readonly removed = new Set<TChild>();

  /**
   * Creates a new DefaultHasManyCollection instance.
   * @param ctx - The entity context
   * @param meta - The entity metadata
   * @param root - The root entity
   * @param relationName - The relation name
   * @param relation - The relation definition
   * @param rootTable - The root table definition
   * @param loader - The loader function for lazy loading
   * @param createEntity - Function to create entities from rows
   * @param localKey - The local key for the relation
   */
  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    private readonly root: unknown,
    private readonly relationName: string,
    private readonly relation: HasManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, unknown>) => TChild,
    private readonly localKey: string
  ) {
    hideInternal(this, ['ctx', 'meta', 'root', 'relationName', 'relation', 'rootTable', 'loader', 'createEntity', 'localKey']);
    hideWritable(this, ['loaded', 'items', 'added', 'removed']);
    this.hydrateFromCache();
  }

  /**
   * Loads the related entities if not already loaded.
   * @returns Promise resolving to the array of child entities
   */
  async load(): Promise<TChild[]> {
    if (this.loaded) return this.items;
    const map = await this.loader();
    const key = toKey((this.root as Record<string, unknown>)[this.localKey]);
    const rows = map.get(key) ?? [];
    this.items = rows.map(row => this.createEntity(row));
    this.loaded = true;
    return this.items;
  }

  /**
   * Gets the current items in the collection.
   * @returns Array of child entities
   */
  getItems(): TChild[] {
    return this.items;
  }
 
  /**
   * Array-compatible length for testing frameworks.
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * Enables iteration over the collection like an array.
   */
  [Symbol.iterator](): Iterator<TChild> {
    return this.items[Symbol.iterator]();
  }

  /**
   * Adds a new child entity to the collection.
   * @param data - Partial data for the new entity
   * @returns The created entity
   */
  add(data: Partial<TChild>): TChild {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    const childRow: Record<string, unknown> = {
      ...data,
      [this.relation.foreignKey]: keyValue
    };
    const entity = this.createEntity(childRow);
    this.added.add(entity);
    this.items.push(entity);
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'add', entity }
    );
    return entity;
  }

  /**
   * Attaches an existing entity to the collection.
   * @param entity - The entity to attach
   */
  attach(entity: TChild): void {
    const keyValue = this.root[this.localKey];
    (entity as Record<string, unknown>)[this.relation.foreignKey] = keyValue;
    this.ctx.markDirty(entity as object);
    this.items.push(entity);
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'attach', entity }
    );
  }

  /**
   * Removes an entity from the collection.
   * @param entity - The entity to remove
   */
  remove(entity: TChild): void {
    this.items = this.items.filter(item => item !== entity);
    this.removed.add(entity);
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'remove', entity }
    );
  }

  /**
   * Clears all entities from the collection.
   */
  clear(): void {
    for (const entity of [...this.items]) {
      this.remove(entity);
    }
  }

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private hydrateFromCache(): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const rows = getHydrationRows(this.meta, this.relationName, keyValue);
    if (!rows?.length) return;
    this.items = rows.map(row => this.createEntity(row));
    this.loaded = true;
  }

  /**
   * Returns the items for JSON serialization.
   * @returns Array of child entities
   */
  toJSON(): unknown[] {
    return this.items.map(item => {
      const entityWithToJSON = item as { toJSON?: () => unknown };
      return typeof entityWithToJSON.toJSON === 'function'
        ? entityWithToJSON.toJSON()
        : item;
    });
  }
}
