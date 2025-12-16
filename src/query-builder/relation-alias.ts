/**
 * Separator used when projecting relational columns
 */
const RELATION_SEPARATOR = '__';

/**
 * Parts of a relation alias
 */
export interface RelationAliasParts {
  /**
   * Relation name (left side of the separator)
   */
  relationName: string;
  /**
   * Column name (right side of the separator)
   */
  columnName: string;
}

/**
 * Builds a relation alias from the relation name and column name components.
 * @param relationName - The name of the relation
 * @param columnName - The name of the column within the relation
 * @returns A relation alias string in the format "relationName__columnName"
 */
export const makeRelationAlias = (relationName: string, columnName: string): string =>
  `${relationName}${RELATION_SEPARATOR}${columnName}`;

/**
 * Parses a relation alias into its relation/column components.
 * Returns `null` when the alias does not follow the `relation__column` pattern.
 * @param alias - The relation alias string to parse
 * @returns Parsed relation alias parts or null if not a valid relation alias
 */
export const parseRelationAlias = (alias: string): RelationAliasParts | null => {
  const idx = alias.indexOf(RELATION_SEPARATOR);
  if (idx === -1) return null;
  return {
    relationName: alias.slice(0, idx),
    columnName: alias.slice(idx + RELATION_SEPARATOR.length)
  };
};

/**
 * Determines whether an alias represents a relation column by checking the `__` convention.
 * @param alias - The alias string to check
 * @returns True if the alias follows the relation alias pattern
 */
export const isRelationAlias = (alias?: string): boolean =>
  !!alias && alias.includes(RELATION_SEPARATOR);
