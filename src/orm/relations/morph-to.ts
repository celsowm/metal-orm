import { BelongsToReferenceApi } from '../../schema/types.js';
import { EntityContext } from '../entity-context.js';
import { RelationKey } from '../runtime-types.js';
import { MorphToRelation } from '../../schema/relation.js';
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

export class DefaultMorphToReference<TParent extends object> implements BelongsToReferenceApi<TParent> {
  private loaded = false;
  private current: TParent | null = null;

  constructor(
    private readonly ctx: EntityContext,
    private readonly meta: EntityMeta<TableDef>,
    private readonly root: unknown,
    private readonly relationName: string,
    private readonly relation: MorphToRelation,
    private readonly rootTable: TableDef,
    private readonly loader: () => Promise<Map<string, Row>>,
    private readonly createEntity: (table: TableDef, row: Row) => TParent,
    private readonly resolveTargetTable: (typeValue: string) => TableDef | undefined
  ) {
    hideInternal(this, [
      'ctx', 'meta', 'root', 'relationName', 'relation',
      'rootTable', 'loader', 'createEntity', 'resolveTargetTable'
    ]);
    hideWritable(this, ['loaded', 'current']);
    this.populateFromHydrationCache();
  }

  async load(): Promise<TParent | null> {
    if (this.loaded) return this.current;
    const rootObj = this.root as Row;
    const typeValue = rootObj[this.relation.typeField];
    const idValue = rootObj[this.relation.idField];
    if (!typeValue || idValue === undefined || idValue === null) {
      this.loaded = true;
      return this.current;
    }

    const map = await this.loader();
    const compositeKey = `${toKey(typeValue)}:${toKey(idValue)}`;
    const row = map.get(compositeKey);
    if (row) {
      const targetTable = this.resolveTargetTable(toKey(typeValue));
      if (targetTable) {
        this.current = this.createEntity(targetTable, row);
      }
    }
    this.loaded = true;
    return this.current;
  }

  get(): TParent | null {
    return this.current;
  }

  set(data: Partial<TParent> | TParent | null): TParent | null {
    if (data === null) {
      return this.detachCurrent();
    }

    const entity = hasEntityMeta(data) ? (data as TParent) : (data as TParent);
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

  private detachCurrent(): TParent | null {
    const previous = this.current;
    if (!previous) return null;
    this.current = null;
    this.loaded = true;
    const rootObj = this.root as Row;
    rootObj[this.relation.typeField] = null;
    rootObj[this.relation.idField] = null;
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

  private get relationKey(): RelationKey {
    return `${this.rootTable.name}.${this.relationName}`;
  }

  private populateFromHydrationCache(): void {
    const rootObj = this.root as Row;
    const typeValue = rootObj[this.relation.typeField];
    const idValue = rootObj[this.relation.idField];
    if (!typeValue || idValue === undefined || idValue === null) return;
    const compositeKey = `${toKey(typeValue)}:${toKey(idValue)}`;
    const row = getHydrationRecord(this.meta, this.relationName, compositeKey);
    if (!row) return;
    const targetTable = this.resolveTargetTable(toKey(typeValue));
    if (targetTable) {
      this.current = this.createEntity(targetTable, row);
      this.loaded = true;
    }
  }
}
