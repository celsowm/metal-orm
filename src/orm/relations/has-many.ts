import { HasManyCollection } from '../../schema/types.js';
import { OrmContext, RelationKey } from '../orm-context.js';
import { HasManyRelation } from '../../schema/relation.js';
import { TableDef } from '../../schema/table.js';
import { EntityMeta, getHydrationRows } from '../entity-meta.js';

type Rows = Record<string, any>[];

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export class DefaultHasManyCollection<TChild> implements HasManyCollection<TChild> {
  private loaded = false;
  private items: TChild[] = [];
  private readonly added = new Set<TChild>();
  private readonly removed = new Set<TChild>();

  constructor(
    private readonly ctx: OrmContext,
    private readonly meta: EntityMeta<any>,
    private readonly root: any,
    private readonly relationName: string,
    private readonly relation: HasManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, any>) => TChild,
    private readonly localKey: string
  ) {
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
    const childRow: Record<string, any> = {
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
}
