/**
 * Determines whether an alias represents a relation column by checking the `__` convention.
 * Keeping this helper centralized avoids inconsistent heuristics between generator and builder.
 */
export const isRelationAlias = (alias?: string): boolean => alias ? alias.includes('__') : false;
