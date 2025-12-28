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
  TRel extends BelongsToManyRelation<infer TTarget, TableDef> ? TTarget :
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
  T extends BelongsToManyRelation<infer TTarget, infer TPivot> ? (InferRow<TTarget> & { _pivot?: InferRow<TPivot> })[] :
  never;

/**
 * Maps relation names to the expected row results
 */
export type RelationMap<TTable extends TableDef> = {
  [K in keyof TTable['relations']]: RelationResult<TTable['relations'][K]>;
};

type RelationWrapper<TRel extends RelationDef> =
  TRel extends HasManyRelation<infer TTarget>
  ? HasManyCollection<EntityInstance<TTarget>> & ReadonlyArray<EntityInstance<TTarget>>
  : TRel extends HasOneRelation<infer TTarget>
  ? HasOneReference<EntityInstance<TTarget>>
  : TRel extends BelongsToManyRelation<infer TTarget, infer TPivot>
  ? ManyToManyCollection<EntityInstance<TTarget> & { _pivot?: InferRow<TPivot> }>
  & ReadonlyArray<EntityInstance<TTarget> & { _pivot?: InferRow<TPivot> }>
  : TRel extends BelongsToRelation<infer TTarget>
  ? BelongsToReference<EntityInstance<TTarget>>
  : never;

export interface HasManyCollection<TChild> {
  length: number;
  [Symbol.iterator](): Iterator<TChild>;
  load(): Promise<TChild[]>;
  getItems(): TChild[];
  add(data: Partial<TChild>): TChild;
  attach(entity: TChild): void;
  remove(entity: TChild): void;
  clear(): void;
}

export interface BelongsToReferenceApi<TParent extends object = object> {
  load(): Promise<TParent | null>;
  get(): TParent | null;
  set(data: Partial<TParent> | TParent | null): TParent | null;
}

export type BelongsToReference<TParent extends object = object> = BelongsToReferenceApi<TParent> & Partial<TParent>;

export interface HasOneReferenceApi<TChild extends object = object> {
  load(): Promise<TChild | null>;
  get(): TChild | null;
  set(data: Partial<TChild> | TChild | null): TChild | null;
}

export type HasOneReference<TChild extends object = object> = HasOneReferenceApi<TChild> & Partial<TChild>;

export interface ManyToManyCollection<TTarget, TPivot extends object | undefined = undefined> {
  length: number;
  [Symbol.iterator](): Iterator<TTarget>;
  load(): Promise<TTarget[]>;
  getItems(): TTarget[];
  attach(target: TTarget | number | string): void;
  detach(target: TTarget | number | string): void;
  syncByIds(ids: (number | string)[]): Promise<void>;
  /** @internal Type-level marker for the related pivot entity */
  readonly __pivotType?: TPivot;
}

export type EntityInstance<
  TTable extends TableDef,
  TRow = InferRow<TTable>
> = TRow & {
  [K in keyof RelationMap<TTable>]: RelationWrapper<TTable['relations'][K]>;
} & {
  $load<K extends keyof RelationMap<TTable>>(relation: K): Promise<RelationMap<TTable>[K]>;
};

export type Primitive = string | number | boolean | Date | bigint | Buffer | null | undefined;

type IsAny<T> = 0 extends (1 & T) ? true : false;

export type SelectableKeys<T> = {
  [K in keyof T]-?: IsAny<T[K]> extends true
  ? never
  : NonNullable<T[K]> extends Primitive
  ? K
  : never
}[keyof T];
