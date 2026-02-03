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

const normalizePivot = (pivot: unknown): Record<string, unknown> | undefined => {
  if (!pivot || typeof pivot !== 'object' || Array.isArray(pivot)) return undefined;
  const entries = Object.entries(pivot as Record<string, unknown>)
    .filter(([, value]) => value !== undefined);
  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
};

const applyPivot = (entity: Record<string, unknown>, pivot?: Record<string, unknown>): void => {
  if (!pivot) return;
  const current = entity._pivot;
  if (current && typeof current === 'object' && !Array.isArray(current)) {
    entity._pivot = { ...(current as Record<string, unknown>), ...pivot };
    return;
  }
  entity._pivot = { ...pivot };
};

/**
 * Default implementation of a many-to-many collection.
 * Manages the relationship between two entities through a pivot table.
 * Supports lazy loading, attaching/detaching entities, and syncing by IDs.
 *
 * @template TTarget The type of the target entities in the collection.
 */
export class DefaultManyToManyCollection<TTarget, TPivot extends object | undefined = undefined>
  implements ManyToManyCollection<TTarget, TPivot> {
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
    hideWritable(this, ['loaded', 'items']);
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
   * Array-compatible length for testing frameworks.
   */
  get length(): number {
    return this.items.length;
  }

  /**
   * Enables iteration over the collection like an array.
   */
  [Symbol.iterator](): Iterator<TTarget> {
    return this.items[Symbol.iterator]();
  }

  /**
   * Attaches an entity to the collection.
   * Registers an 'attach' change in the entity context.
   * @param target Entity instance or its primary key value.
   */
  attach(target: TTarget | number | string, pivot?: Partial<TPivot> | Record<string, unknown>): void {
    const entity = this.ensureEntity(target);
    const id = this.extractId(entity);
    const pivotPayload = this.filterPivotPayload(normalizePivot(pivot));
    const existing = id != null
      ? this.items.find(item => this.extractId(item) === id)
      : this.items.find(item => item === entity);

    if (existing) {
      if (pivotPayload) {
        applyPivot(existing as Record<string, unknown>, pivotPayload);
        this.ctx.registerRelationChange(
          this.root,
          this.relationKey,
          this.rootTable,
          this.relationName,
          this.relation,
          { kind: 'update', entity: existing, pivot: pivotPayload }
        );
      }
      return;
    }

    if (pivotPayload) {
      applyPivot(entity as Record<string, unknown>, pivotPayload);
    }
    this.items.push(entity);
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'attach', entity, pivot: pivotPayload }
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

  private filterPivotPayload(pivot?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!pivot) return undefined;
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(pivot)) {
      if (value === undefined) continue;
      if (!this.relation.pivotTable.columns[key]) continue;
      if (key === this.relation.pivotForeignKeyToRoot || key === this.relation.pivotForeignKeyToTarget) continue;
      payload[key] = value;
    }
    return Object.keys(payload).length ? payload : undefined;
  }

  private hydrateFromCache(): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const rows = getHydrationRows(this.meta, this.relationName, keyValue);
    if (!rows?.length) return;
    this.items = rows.map(row => {
      const entity = this.createEntity(row);
      if ((row as { _pivot?: unknown })._pivot) {
        (entity as { _pivot?: unknown })._pivot = (row as { _pivot?: unknown })._pivot;
      }
      return entity;
    });
    this.loaded = true;
  }

  toJSON(): unknown[] {
    return this.items.map(item => {
      const entityWithToJSON = item as { toJSON?: () => unknown };
      return typeof entityWithToJSON.toJSON === 'function'
        ? entityWithToJSON.toJSON()
        : item;
    });
  }
}
