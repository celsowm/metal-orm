import { HasManyCollection } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { MorphManyRelation } from '../../schema/relation.js';
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

export class DefaultMorphManyCollection<TChild> implements HasManyCollection<TChild> {
  private loaded = false;
  private items: TChild[] = [];
  private readonly added = new Set<TChild>();
  private readonly removed = new Set<TChild>();

  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    private readonly root: unknown,
    private readonly relationName: string,
    private readonly relation: MorphManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, unknown>) => TChild,
    private readonly localKey: string
  ) {
    hideInternal(this, ['ctx', 'meta', 'root', 'relationName', 'relation', 'rootTable', 'loader', 'createEntity', 'localKey']);
    hideWritable(this, ['loaded', 'items', 'added', 'removed']);
    this.hydrateFromCache();
  }

  async load(): Promise<TChild[]> {
    if (this.loaded) return this.items;
    const map = await this.loader();
    const key = toKey((this.root as Record<string, unknown>)[this.localKey]);
    const rows = map.get(key) ?? [];
    this.items = rows.map(row => this.createEntity(row));
    this.loaded = true;
    return this.items;
  }

  getItems(): TChild[] {
    return this.items;
  }

  get length(): number {
    return this.items.length;
  }

  [Symbol.iterator](): Iterator<TChild> {
    return this.items[Symbol.iterator]();
  }

  add(data: Partial<TChild>): TChild {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    const childRow: Record<string, unknown> = {
      ...data,
      [this.relation.idField]: keyValue,
      [this.relation.typeField]: this.relation.typeValue
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

  attach(entity: TChild): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    (entity as Record<string, unknown>)[this.relation.idField] = keyValue;
    (entity as Record<string, unknown>)[this.relation.typeField] = this.relation.typeValue;
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

  toJSON(): unknown[] {
    return this.items.map(item => {
      const entityWithToJSON = item as { toJSON?: () => unknown };
      return typeof entityWithToJSON.toJSON === 'function'
        ? entityWithToJSON.toJSON()
        : item;
    });
  }
}
