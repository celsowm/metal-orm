import { ManyToManyCollection } from '../../schema/types';
import { OrmContext, RelationKey } from '../orm-context';
import { BelongsToManyRelation } from '../../schema/relation';
import { TableDef } from '../../schema/table';
import { findPrimaryKey } from '../../query-builder/hydration-planner';
import { EntityMeta, getHydrationRows } from '../entity-meta';

type Rows = Record<string, any>[];

const toKey = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export class DefaultManyToManyCollection<TTarget> implements ManyToManyCollection<TTarget> {
  private loaded = false;
  private items: TTarget[] = [];

  constructor(
    private readonly ctx: OrmContext,
    private readonly meta: EntityMeta<any>,
    private readonly root: any,
    private readonly relationName: string,
    private readonly relation: BelongsToManyRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, any>) => TTarget,
    private readonly localKey: string
  ) {
    this.hydrateFromCache();
  }

  async load(): Promise<TTarget[]> {
    if (this.loaded) return this.items;
    const map = await this.loader();
    const key = toKey(this.root[this.localKey]);
    const rows = map.get(key) ?? [];
    this.items = rows.map(row => {
      const entity = this.createEntity(row);
      if ((row as any)._pivot) {
        (entity as any)._pivot = row._pivot;
      }
      return entity;
    });
    this.loaded = true;
    return this.items;
  }

  getItems(): TTarget[] {
    return this.items;
  }

  attach(target: TTarget | number | string): void {
    const entity = this.ensureEntity(target);
    const id = this.extractId(entity);
    if (id == null) return;
    if (this.items.some(item => this.extractId(item) === id)) {
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

  async syncByIds(ids: (number | string)[]): Promise<void> {
    await this.load();
    const targetKey = this.relation.targetKey || findPrimaryKey(this.relation.target);
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
      const stub: Record<string, any> = {
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
    return (entity as any)[this.targetKey] ?? null;
  }

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private get targetKey(): string {
    return this.relation.targetKey || findPrimaryKey(this.relation.target);
  }

  private hydrateFromCache(): void {
    const keyValue = this.root[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const rows = getHydrationRows(this.meta, this.relationName, keyValue);
    if (!rows?.length) return;
    this.items = rows.map(row => {
      const entity = this.createEntity(row);
      if ((row as any)._pivot) {
        (entity as any)._pivot = (row as any)._pivot;
      }
      return entity;
    });
    this.loaded = true;
  }
}
