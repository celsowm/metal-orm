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

export class DefaultHasManyCollection<TChild> implements HasManyCollection<TChild> {
  private loaded = false;
  private items: TChild[] = [];
  private readonly added = new Set<TChild>();
  private readonly removed = new Set<TChild>();

  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly root: any,
    private readonly relationName: string,
    private readonly relation: HasManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, unknown>) => TChild,
    private readonly localKey: string
  ) {
    hideInternal(this, ['ctx', 'meta', 'root', 'relationName', 'relation', 'rootTable', 'loader', 'createEntity', 'localKey']);
    this.hydrateFromCache();
  }

  async load(): Promise<TChild[]> {
    if (this.loaded) return this.items;
    const map = await this.loader();
    const key = toKey(this.root[this.localKey]);
    const rows = map.get(key) ?? [];
    this.items = rows.map(row => this.createEntity(row));
    this.loaded = true;
    return this.items;
  }

  getItems(): TChild[] {
    return this.items;
  }

  add(data: Partial<TChild>): TChild {
    const keyValue = this.root[this.localKey];
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

  attach(entity: TChild): void {
    const keyValue = this.root[this.localKey];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (entity as Record<string, any>)[this.relation.foreignKey] = keyValue;
    this.ctx.markDirty(entity);
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
    const keyValue = this.root[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const rows = getHydrationRows(this.meta, this.relationName, keyValue);
    if (!rows?.length) return;
    this.items = rows.map(row => this.createEntity(row));
    this.loaded = true;
  }

  toJSON(): TChild[] {
    return this.items;
  }
}
