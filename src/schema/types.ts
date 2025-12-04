import { ColumnDef } from './column.js';
import { TableDef } from './table.js';
import {
  RelationDef,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation
} from './relation.js';

/**
 * Maps a ColumnDef to its TypeScript type representation
 */
export type ColumnToTs<T extends ColumnDef> =
  T['type'] extends 'INT' | 'INTEGER' | 'int' | 'integer' ? number :
  T['type'] extends 'BOOLEAN' | 'boolean' ? boolean :
  T['type'] extends 'JSON' | 'json' ? unknown :
  string;

/**
 * Infers a row shape from a table definition
 */
export type InferRow<TTable extends TableDef> = {
  [K in keyof TTable['columns']]: ColumnToTs<TTable['columns'][K]>;
};

type RelationResult<T extends RelationDef> =
  T extends HasManyRelation<infer TTarget>        ? InferRow<TTarget>[] :
  T extends BelongsToRelation<infer TTarget>      ? InferRow<TTarget> | null :
  T extends BelongsToManyRelation<infer TTarget>  ? (InferRow<TTarget> & { _pivot?: any })[] :
  never;

/**
 * Maps relation names to the expected row results
 */
export type RelationMap<TTable extends TableDef> = {
  [K in keyof TTable['relations']]: RelationResult<TTable['relations'][K]>;
};

export interface HasManyCollection<TChild> {
  load(): Promise<TChild[]>;
  getItems(): TChild[];
  add(data: Partial<TChild>): TChild;
  attach(entity: TChild): void;
  remove(entity: TChild): void;
  clear(): void;
}

export interface BelongsToReference<TParent> {
  load(): Promise<TParent | null>;
  get(): TParent | null;
  set(data: Partial<TParent> | TParent | null): TParent | null;
}

export interface ManyToManyCollection<TTarget> {
  load(): Promise<TTarget[]>;
  getItems(): TTarget[];
  attach(target: TTarget | number | string): void;
  detach(target: TTarget | number | string): void;
  syncByIds(ids: (number | string)[]): Promise<void>;
}

export type Entity<
  TTable extends TableDef,
  TRow = InferRow<TTable>
> = TRow & {
  [K in keyof RelationMap<TTable>]:
    TTable['relations'][K] extends HasManyRelation<infer TTarget>
      ? HasManyCollection<Entity<TTarget>>
      : TTable['relations'][K] extends BelongsToManyRelation<infer TTarget>
        ? ManyToManyCollection<Entity<TTarget>>
        : TTable['relations'][K] extends BelongsToRelation<infer TTarget>
          ? BelongsToReference<Entity<TTarget>>
          : never;
} & {
  $load<K extends keyof RelationMap<TTable>>(relation: K): Promise<RelationMap<TTable>[K]>;
};
