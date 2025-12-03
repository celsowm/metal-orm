import { TableDef } from '../schema/table';
import { RelationDef, RelationKinds } from '../schema/relation';
import { ExpressionNode, eq, and } from '../ast/expression';
import { findPrimaryKey } from './hydration-planner';

/**
 * Utility function to handle unreachable code paths
 * @param value - Value that should never occur
 * @throws Error indicating unhandled relation type
 */
const assertNever = (value: never): never => {
  throw new Error(`Unhandled relation type: ${JSON.stringify(value)}`);
};

/**
 * Builds the base condition for a relation join
 * @param root - Root table definition
 * @param relation - Relation definition
 * @returns Expression node representing the join condition
 */
const baseRelationCondition = (root: TableDef, relation: RelationDef): ExpressionNode => {
  const defaultLocalKey =
    relation.type === RelationKinds.HasMany
      ? findPrimaryKey(root)
      : findPrimaryKey(relation.target);
  const localKey = relation.localKey || defaultLocalKey;

  switch (relation.type) {
    case RelationKinds.HasMany:
      return eq(
        { type: 'Column', table: relation.target.name, name: relation.foreignKey },
        { type: 'Column', table: root.name, name: localKey }
      );
    case RelationKinds.BelongsTo:
      return eq(
        { type: 'Column', table: relation.target.name, name: localKey },
        { type: 'Column', table: root.name, name: relation.foreignKey }
      );
    default:
      return assertNever(relation);
  }
};

/**
 * Builds a relation join condition with optional extra conditions
 * @param root - Root table definition
 * @param relation - Relation definition
 * @param extra - Optional additional expression to combine with AND
 * @returns Expression node representing the complete join condition
 */
export const buildRelationJoinCondition = (
  root: TableDef,
  relation: RelationDef,
  extra?: ExpressionNode
): ExpressionNode => {
  const base = baseRelationCondition(root, relation);
  return extra ? and(base, extra) : base;
};

/**
 * Builds a relation correlation condition for subqueries
 * @param root - Root table definition
 * @param relation - Relation definition
 * @returns Expression node representing the correlation condition
 */
export const buildRelationCorrelation = (root: TableDef, relation: RelationDef): ExpressionNode => {
  return baseRelationCondition(root, relation);
};
