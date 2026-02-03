import type {
  BelongsToReference,
  HasManyCollection,
  HasOneReference,
  ManyToManyCollection
} from '../schema/types.js';

type AnyId = number | string;
type AnyFn = (...args: unknown[]) => unknown;
type PivotInput = { _pivot?: Record<string, unknown>; pivot?: Record<string, unknown> };

type RelationWrapper =
  | HasManyCollection<unknown>
  | HasOneReference
  | BelongsToReference
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
 * Input scalar type for `OrmSession.saveGraph` payloads.
 *
 * Note: runtime coercion is opt-in via `SaveGraphOptions.coerce`.
 * For Date columns, string input is only safe when using `coerce: 'json-in'`.
 */
export type SaveGraphInputScalar<T> = T extends Date ? T | string | number : T;

type ColumnInput<TEntity> = {
  [K in ColumnKeys<TEntity>]?: SaveGraphInputScalar<TEntity[K]>;
};

type RelationInputValue<T> =
  T extends HasManyCollection<infer C> ? Array<SaveGraphInputPayload<C> | AnyId> :
  T extends HasOneReference<infer C> ? SaveGraphInputPayload<C> | AnyId | null :
  T extends BelongsToReference<infer P> ? SaveGraphInputPayload<P> | AnyId | null :
  T extends ManyToManyCollection<infer Tgt> ? Array<(SaveGraphInputPayload<Tgt> & PivotInput) | AnyId> :
  never;

type RelationInput<TEntity> = {
  [K in RelationKeys<TEntity>]?: RelationInputValue<NonNullable<TEntity[K]>>;
};

/**
 * Typed payload accepted by `OrmSession.saveGraph`:
 * - Only entity scalar keys + relation keys are accepted.
 */
export type SaveGraphInputPayload<TEntity> = ColumnInput<TEntity> & RelationInput<TEntity>;

/**
 * Typed payload accepted by `OrmSession.patchGraph`:
 * - All keys are optional (partial update semantics).
 * - Only entity scalar keys + relation keys are accepted.
 */
export type PatchGraphInputPayload<TEntity> = Partial<ColumnInput<TEntity>> & Partial<RelationInput<TEntity>>;
