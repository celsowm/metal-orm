export type JsonifyScalar<T> = T extends Date ? string : T;

/**
 * Shallow JSON-friendly mapping:
 * - Date -> ISO string
 * - Everything else unchanged
 */
export type Jsonify<T> = {
  [K in keyof T]: JsonifyScalar<T[K]>;
};

/**
 * Creates a shallow, JSON-friendly copy of an object by converting `Date` values to ISO strings.
 * This intentionally does not deep-walk nested objects/relations.
 */
export const jsonify = <T extends object>(value: T): Jsonify<T> => {
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(record)) {
    const entry = record[key];
    result[key] = entry instanceof Date ? entry.toISOString() : entry;
  }

  return result as Jsonify<T>;
};

