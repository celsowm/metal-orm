import { BelongsToReference } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { BelongsToRelation } from '../../schema/relation.js';
import { TableDef } from '../../schema/table.js';
import { EntityMeta, getHydrationRecord, hasEntityMeta } from '../entity-meta.js';

type Rows = Record<string, unknown>;

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

export class DefaultBelongsToReference<TParent> implements BelongsToReference<TParent> {
  private loaded = false;
  private current: TParent | null = null;

  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly root: any,
    private readonly relationName: string,
    private readonly relation: BelongsToRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Rows>>,
    private readonly createEntity: (row: Record<string, unknown>) => TParent,
    private readonly targetKey: string
  ) {
    hideInternal(this, ['ctx', 'meta', 'root', 'relationName', 'relation', 'rootTable', 'loader', 'createEntity', 'targetKey']);
    this.populateFromHydrationCache();
  }

  async load(): Promise<TParent | null> {
    if (this.loaded) return this.current;
    const map = await this.loader();
    const fkValue = this.root[this.relation.foreignKey];
    if (fkValue === null || fkValue === undefined) {
      this.current = null;
    } else {
      const row = map.get(toKey(fkValue));
      this.current = row ? this.createEntity(row) : null;
    }
    this.loaded = true;
    return this.current;
  }

  get(): TParent | null {
    return this.current;
  }

  set(data: Partial<TParent> | TParent | null): TParent | null {
    if (data === null) {
      const previous = this.current;
      this.root[this.relation.foreignKey] = null;
      this.current = null;
      this.ctx.registerRelationChange(
        this.root,
        this.relationKey,
        this.rootTable,
        this.relationName,
        this.relation,
        { kind: 'remove', entity: previous }
      );
      return null;
    }

    const entity = hasEntityMeta(data) ? (data as TParent) : this.createEntity(data as Record<string, unknown>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pkValue = (entity as any)[this.targetKey];
    if (pkValue !== undefined) {
      this.root[this.relation.foreignKey] = pkValue;
    }
    this.current = entity;
    this.ctx.registerRelationChange(
      this.root,
      this.relationKey,
      this.rootTable,
      this.relationName,
      this.relation,
      { kind: 'attach', entity }
    );
    return entity;
  }

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private populateFromHydrationCache(): void {
    const fkValue = this.root[this.relation.foreignKey];
    if (fkValue === undefined || fkValue === null) return;
    const row = getHydrationRecord(this.meta, this.relationName, fkValue);
    if (!row) return;
    this.current = this.createEntity(row);
    this.loaded = true;
  }

  toJSON(): TParent | null {
    return this.current;
  }
}
