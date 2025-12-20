import type { ColumnDef } from './column-types.js';
export type { ColumnDef };
import { TableDef } from './table.js';
import {
  RelationDef,
  HasManyRelation,
  HasOneRelation,
  BelongsToRelation,
  BelongsToManyRelation
} from './relation.js';

/**
 * Resolves a relation definition to its target table type.
 */
export type RelationTargetTable<TRel extends RelationDef> =
  TRel extends HasManyRelation<infer TTarget> ? TTarget :
  TRel extends HasOneRelation<infer TTarget> ? TTarget :
  TRel extends BelongsToRelation<infer TTarget> ? TTarget :
  TRel extends BelongsToManyRelation<infer TTarget> ? TTarget :
  never;

type NormalizedColumnType<T extends ColumnDef> = Lowercase<T['type'] & string>;

/**
 * Maps a ColumnDef to its TypeScript type representation
 */
export type ColumnToTs<T extends ColumnDef> =
  [unknown] extends [T['tsType']]
  ? NormalizedColumnType<T> extends 'int' | 'integer' ? number :
  NormalizedColumnType<T> extends 'bigint' ? number | bigint :
  NormalizedColumnType<T> extends 'decimal' | 'float' | 'double' ? number :
  NormalizedColumnType<T> extends 'boolean' ? boolean :
  NormalizedColumnType<T> extends 'json' ? unknown :
  NormalizedColumnType<T> extends 'blob' | 'binary' | 'varbinary' | 'bytea' ? Buffer :
  NormalizedColumnType<T> extends 'date' | 'datetime' | 'timestamp' | 'timestamptz' ? string :
  string
  : Exclude<T['tsType'], undefined>;

/**
 * Infers a row shape from a table definition
 */
export type InferRow<TTable extends TableDef> = {
  [K in keyof TTable['columns']]: ColumnToTs<TTable['columns'][K]>;
};

type RelationResult<T extends RelationDef> =
  T extends HasManyRelation<infer TTarget> ? InferRow<TTarget>[] :
  T extends HasOneRelation<infer TTarget> ? InferRow<TTarget> | null :
  T extends BelongsToRelation<infer TTarget> ? InferRow<TTarget> | null :
  T extends BelongsToManyRelation<infer TTarget> ? (InferRow<TTarget> & { _pivot?: unknown })[] :
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

export interface HasOneReference<TChild> {
  load(): Promise<TChild | null>;
  get(): TChild | null;
  set(data: Partial<TChild> | TChild | null): TChild | null;
}

export interface ManyToManyCollection<TTarget> {
  load(): Promise<TTarget[]>;
  getItems(): TTarget[];
  attach(target: TTarget | number | string): void;
  detach(target: TTarget | number | string): void;
  syncByIds(ids: (number | string)[]): Promise<void>;
}

export type EntityInstance<
  TTable extends TableDef,
  TRow = InferRow<TTable>
> = TRow & {
  [K in keyof RelationMap<TTable>]:
  TTable['relations'][K] extends HasManyRelation<infer TTarget>
  ? HasManyCollection<EntityInstance<TTarget>>
  : TTable['relations'][K] extends HasOneRelation<infer TTarget>
  ? HasOneReference<EntityInstance<TTarget>>
  : TTable['relations'][K] extends BelongsToManyRelation<infer TTarget>
  ? ManyToManyCollection<EntityInstance<TTarget>>
  : TTable['relations'][K] extends BelongsToRelation<infer TTarget>
  ? BelongsToReference<EntityInstance<TTarget>>
  : never;
} & {
  $load<K extends keyof RelationMap<TTable>>(relation: K): Promise<RelationMap<TTable>[K]>;
};

export type Primitive = string | number | boolean | Date | bigint | Buffer | null | undefined;

export type SelectableKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends Primitive ? K : never
}[keyof T];
