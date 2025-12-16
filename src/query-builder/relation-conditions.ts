import { TableDef } from '../schema/table.js';
import { RelationDef, RelationKinds, BelongsToManyRelation } from '../schema/relation.js';
import { ExpressionNode, eq, and } from '../core/ast/expression.js';
import { findPrimaryKey } from './hydration-planner.js';
import { JoinNode } from '../core/ast/join.js';
import { JoinKind } from '../core/sql/sql.js';
import { createJoinNode } from '../core/ast/join-node.js';

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
const baseRelationCondition = (root: TableDef, relation: RelationDef, rootAlias?: string): ExpressionNode => {
  const rootTable = rootAlias || root.name;
  const defaultLocalKey =
    relation.type === RelationKinds.HasMany || relation.type === RelationKinds.HasOne
      ? findPrimaryKey(root)
      : findPrimaryKey(relation.target);
  const localKey = relation.localKey || defaultLocalKey;

  switch (relation.type) {
    case RelationKinds.HasMany:
    case RelationKinds.HasOne:
      return eq(
        { type: 'Column', table: relation.target.name, name: relation.foreignKey },
        { type: 'Column', table: rootTable, name: localKey }
      );
    case RelationKinds.BelongsTo:
      return eq(
        { type: 'Column', table: relation.target.name, name: localKey },
        { type: 'Column', table: rootTable, name: relation.foreignKey }
      );
    case RelationKinds.BelongsToMany:
      throw new Error('BelongsToMany relations do not support the standard join condition builder');
    default:
      return assertNever(relation);
  }
};

/**
 * Builds the join nodes required to include a BelongsToMany relation.
 * @param root - The root table definition
 * @param relationName - Name of the relation being joined
 * @param relation - The BelongsToMany relation definition
 * @param joinKind - The type of join to perform
 * @param extra - Optional additional conditions for the target join
 * @param rootAlias - Optional alias for the root table
 * @returns Array of join nodes for the pivot and target tables
 */
export const buildBelongsToManyJoins = (
  root: TableDef,
  relationName: string,
  relation: BelongsToManyRelation,
  joinKind: JoinKind,
  extra?: ExpressionNode,
  rootAlias?: string
): JoinNode[] => {
  const rootKey = relation.localKey || findPrimaryKey(root);
  const targetKey = relation.targetKey || findPrimaryKey(relation.target);
  const rootTable = rootAlias || root.name;

  const pivotCondition = eq(
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToRoot },
    { type: 'Column', table: rootTable, name: rootKey }
  );

  const pivotJoin = createJoinNode(
    joinKind,
    { type: 'Table', name: relation.pivotTable.name, schema: relation.pivotTable.schema },
    pivotCondition
  );

  let targetCondition: ExpressionNode = eq(
    { type: 'Column', table: relation.target.name, name: targetKey },
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToTarget }
  );

  if (extra) {
    targetCondition = and(targetCondition, extra);
  }

  const targetJoin = createJoinNode(
    joinKind,
    { type: 'Table', name: relation.target.name, schema: relation.target.schema },
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
 * @param rootAlias - Optional alias for the root table
 * @returns Expression node representing the complete join condition
 */
export const buildRelationJoinCondition = (
  root: TableDef,
  relation: RelationDef,
  extra?: ExpressionNode,
  rootAlias?: string
): ExpressionNode => {
  const base = baseRelationCondition(root, relation, rootAlias);
  return extra ? and(base, extra) : base;
};

/**
 * Builds a relation correlation condition for subqueries
 * @param root - Root table definition
 * @param relation - Relation definition
 * @param rootAlias - Optional alias for the root table
 * @returns Expression node representing the correlation condition
 */
export const buildRelationCorrelation = (root: TableDef, relation: RelationDef, rootAlias?: string): ExpressionNode => {
  return baseRelationCondition(root, relation, rootAlias);
};
