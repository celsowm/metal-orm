import { HasOneReferenceApi } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { MorphOneRelation } from '../../schema/relation.js';
import { TableDef } from '../../schema/table.js';
import { EntityMeta, getHydrationRecord, hasEntityMeta } from '../entity-meta.js';

type Row = Record<string, unknown>;

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

export class DefaultMorphOneReference<TChild extends object> implements HasOneReferenceApi<TChild> {
  private loaded = false;
  private current: TChild | null = null;

  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    private readonly root: unknown,
    private readonly relationName: string,
    private readonly relation: MorphOneRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Row>>,
    private readonly createEntity: (row: Row) => TChild,
    private readonly localKey: string
  ) {
    hideInternal(this, [
      'ctx', 'meta', 'root', 'relationName', 'relation',
      'rootTable', 'loader', 'createEntity', 'localKey'
    ]);
    hideWritable(this, ['loaded', 'current']);
    this.populateFromHydrationCache();
  }

  async load(): Promise<TChild | null> {
    if (this.loaded) return this.current;
    const map = await this.loader();
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    if (keyValue === undefined || keyValue === null) {
      this.loaded = true;
      return this.current;
    }
    const row = map.get(toKey(keyValue));
    this.current = row ? this.createEntity(row) : null;
    this.loaded = true;
    return this.current;
  }

  get(): TChild | null {
    return this.current;
  }

  set(data: Partial<TChild> | TChild | null): TChild | null {
    if (data === null) {
      return this.detachCurrent();
    }

    const entity = hasEntityMeta(data) ? (data as TChild) : this.createEntity(data as Row);
    if (this.current && this.current !== entity) {
      this.ctx.registerRelationChange(
        this.root,
        this.relationKey,
        this.rootTable,
        this.relationName,
        this.relation,
        { kind: 'remove', entity: this.current }
      );
    }

    this.assignMorphKeys(entity);
    this.current = entity;
    this.loaded = true;

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

  toJSON(): unknown {
    if (!this.current) return null;
    const entityWithToJSON = this.current as { toJSON?: () => unknown };
    return typeof entityWithToJSON.toJSON === 'function'
      ? entityWithToJSON.toJSON()
      : this.current;
  }

  private detachCurrent(): TChild | null {
    const previous = this.current;
    if (!previous) return null;
    this.current = null;
    this.loaded = true;
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

  private assignMorphKeys(entity: TChild): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    (entity as Row)[this.relation.idField] = keyValue;
    (entity as Row)[this.relation.typeField] = this.relation.typeValue;
  }

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private populateFromHydrationCache(): void {
    const keyValue = (this.root as Record<string, unknown>)[this.localKey];
    if (keyValue === undefined || keyValue === null) return;
    const row = getHydrationRecord(this.meta, this.relationName, keyValue);
    if (!row) return;
    this.current = this.createEntity(row);
    this.loaded = true;
  }
}
