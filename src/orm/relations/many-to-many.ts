import { ManyToManyCollection } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { BelongsToManyRelation } from '../../schema/relation.js';
import { TableDef } from '../../schema/table.js';
import { findPrimaryKey } from '../../query-builder/hydration-planner.js';
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

/**
 * Default implementation of a many-to-many collection.
 * Manages the relationship between two entities through a pivot table.
 * Supports lazy loading, attaching/detaching entities, and syncing by IDs.
 *
 * @template TTarget The type of the target entities in the collection.
 */
export class DefaultManyToManyCollection<TTarget> implements ManyToManyCollection<TTarget> {
  private loaded = false;
  private items: TTarget[] = [];

  /**
   * @param ctx The entity context for tracking changes.
   * @param meta Metadata for the root entity.
   * @param root The root entity instance.
   * @param relationName The name of the relation.
   * @param relation Relation definition.
   * @param rootTable Table definition of the root entity.
   * @param loader Function to load the collection items.
   * @param createEntity Function to create entity instances from rows.
   * @param localKey The local key used for joining.
   */
  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    private readonly root: unknown,
    private readonly relationName: string,
    private readonly relation: BelongsToManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, unknown>) => TTarget,
    private readonly localKey: string
  ) {
    hideInternal(this, ['ctx', 'meta', 'root', 'relationName', 'relation', 'rootTable', 'loader', 'createEntity', 'localKey']);
    this.hydrateFromCache();
  }

  /**
   * Loads the collection items if not already loaded.
   * @returns A promise that resolves to the array of target entities.
   */
  async load(): Promise<TTarget[]> {
    if (this.loaded) return this.items;
    const map = await this.loader();
    const key = toKey(this.root[this.localKey]);
    const rows = map.get(key) ?? [];
    this.items = rows.map(row => {
      const entity = this.createEntity(row);
      if ((row as { _pivot?: unknown })._pivot) {
        (entity as { _pivot?: unknown })._pivot = (row as { _pivot?: unknown })._pivot;
      }
      return entity;
    });
    this.loaded = true;
    return this.items;
  }

  /**
   * Returns the currently loaded items.
   * @returns Array of target entities.
   */
  getItems(): TTarget[] {
    return this.items;
  }

  /**
   * Attaches an entity to the collection.
   * Registers an 'attach' change in the entity context.
   * @param target Entity instance or its primary key value.
   */
  attach(target: TTarget | number | string): void {
    const entity = this.ensureEntity(target);
    const id = this.extractId(entity);
    if (id != null && this.items.some(item => this.extractId(item) === id)) {
      return;
    }
    if (id == null && this.items.includes(entity)) {
      return;
    }
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
   * Detaches an entity from the collection.
   * Registers a 'detach' change in the entity context.
   * @param target Entity instance or its primary key value.
   */
  detach(target: TTarget | number | string): void {
    const id = typeof target === 'number' || typeof target === 'string'
      ? target
      : this.extractId(target);

    if (id == null) return;

    const existing = this.items.find(item => this.extractId(item) === id);
    if (!existing) return;

    this.items = this.items.filter(item => this.extractId(item) !== id);
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'detach', entity: existing }
    );
  }

  /**
   * Syncs the collection with a list of IDs.
   * Attaches missing IDs and detaches IDs not in the list.
   * @param ids Array of primary key values to sync with.
   */
  async syncByIds(ids: (number | string)[]): Promise<void> {
    await this.load();
    const normalized = new Set(ids.map(id => toKey(id)));
    const currentIds = new Set(this.items.map(item => toKey(this.extractId(item))));

    for (const id of normalized) {
      if (!currentIds.has(id)) {
        this.attach(id);
      }
    }

    for (const item of [...this.items]) {
      const itemId = toKey(this.extractId(item));
      if (!normalized.has(itemId)) {
        this.detach(item);
      }
    }
  }

  private ensureEntity(target: TTarget | number | string): TTarget {
    if (typeof target === 'number' || typeof target === 'string') {
      const stub: Record<string, unknown> = {
        [this.targetKey]: target
      };
      return this.createEntity(stub);
    }
    return target;
  }

  private extractId(entity: TTarget | number | string | null | undefined): number | string | null {
    if (entity === null || entity === undefined) return null;
    if (typeof entity === 'number' || typeof entity === 'string') {
      return entity;
    }
    return (entity as Record<string, unknown>)[this.targetKey] as string | number | null ?? null;
  }

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private get targetKey(): string {
    return this.relation.targetKey || findPrimaryKey(this.relation.target);
  }

  private hydrateFromCache(): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const rows = getHydrationRows(this.meta, this.relationName, keyValue);
    if (!rows?.length) return;
    this.items = rows.map(row => {
      const entity = this.createEntity(row);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((row as { _pivot?: unknown })._pivot) {
        (entity as { _pivot?: unknown })._pivot = (row as { _pivot?: unknown })._pivot;
      }
      return entity;
    });
    this.loaded = true;
  }

  toJSON(): TTarget[] {
    return this.items;
  }
}
