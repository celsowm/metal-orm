import { TableDef } from '../schema/table';
import { RelationDef, RelationKinds, BelongsToManyRelation } from '../schema/relation';
import { ExpressionNode, eq, and } from '../ast/expression';
import { findPrimaryKey } from './hydration-planner';
import { JoinNode } from '../ast/join';
import { JoinKind } from '../constants/sql';
import { createJoinNode } from '../utils/join-node';

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
    case RelationKinds.BelongsToMany:
      throw new Error('BelongsToMany relations do not support the standard join condition builder');
    default:
      return assertNever(relation);
  }
};

/**
 * Builds the join nodes required to include a BelongsToMany relation.
 */
export const buildBelongsToManyJoins = (
  root: TableDef,
  relationName: string,
  relation: BelongsToManyRelation,
  joinKind: JoinKind,
  extra?: ExpressionNode
): JoinNode[] => {
  const rootKey = relation.localKey || findPrimaryKey(root);
  const targetKey = relation.targetKey || findPrimaryKey(relation.target);

  const pivotCondition = eq(
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToRoot },
    { type: 'Column', table: root.name, name: rootKey }
  );

  const pivotJoin = createJoinNode(joinKind, relation.pivotTable.name, pivotCondition);

  let targetCondition: ExpressionNode = eq(
    { type: 'Column', table: relation.target.name, name: targetKey },
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToTarget }
  );

  if (extra) {
    targetCondition = and(targetCondition, extra);
  }

  const targetJoin = createJoinNode(
    joinKind,
    relation.target.name,
    targetCondition,
    relationName
  );

  return [pivotJoin, targetJoin];
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
