import type {
  BelongsToReference,
  HasManyCollection,
  HasOneReference,
  ManyToManyCollection
} from '../schema/types.js';

type AnyId = number | string;
type AnyFn = (...args: unknown[]) => unknown;

type RelationWrapper =
  | HasManyCollection<unknown>
  | HasOneReference<unknown>
  | BelongsToReference<unknown>
  | ManyToManyCollection<unknown>;

type FunctionKeys<T> = {
  [K in keyof T & string]-?: T[K] extends AnyFn ? K : never;
}[keyof T & string];

type RelationKeys<T> = {
  [K in keyof T & string]-?: NonNullable<T[K]> extends RelationWrapper ? K : never;
}[keyof T & string];

type ColumnKeys<T> = Exclude<keyof T & string, FunctionKeys<T> | RelationKeys<T>>;

export type SaveGraphJsonScalar<T> = T extends Date ? string : T;

/**
 * Input scalar type that accepts JSON-friendly values for common runtime types.
 * Currently:
 * - Date fields accept `Date | string` (ISO string recommended)
 */
export type SaveGraphInputScalar<T> =
  T extends Date ? Date | string : T;

type ColumnInput<TEntity> = {
  [K in ColumnKeys<TEntity>]?: SaveGraphInputScalar<TEntity[K]>;
};

type RelationInputValue<T> =
  T extends HasManyCollection<infer C> ? Array<SaveGraphInputPayload<C> | AnyId> :
  T extends HasOneReference<infer C> ? SaveGraphInputPayload<C> | AnyId | null :
  T extends BelongsToReference<infer P> ? SaveGraphInputPayload<P> | AnyId | null :
  T extends ManyToManyCollection<infer Tgt> ? Array<SaveGraphInputPayload<Tgt> | AnyId> :
  never;

type RelationInput<TEntity> = {
  [K in RelationKeys<TEntity>]?: RelationInputValue<NonNullable<TEntity[K]>>;
};

/**
 * Typed payload accepted by `OrmSession.saveGraph`:
 * - Only entity scalar keys + relation keys are accepted.
 * - Scalars can use JSON-friendly values (e.g., Date fields accept ISO strings).
 */
export type SaveGraphInputPayload<TEntity> = ColumnInput<TEntity> & RelationInput<TEntity>;
