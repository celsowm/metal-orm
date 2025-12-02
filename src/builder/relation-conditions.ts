import { TableDef } from '../schema/table';
import { RelationDef, RelationKinds } from '../schema/relation';
import { ExpressionNode, eq, and } from '../ast/expression';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled relation type: ${JSON.stringify(value)}`);
};

const baseRelationCondition = (root: TableDef, relation: RelationDef): ExpressionNode => {
  const localKey = relation.localKey || 'id';

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

export const buildRelationJoinCondition = (
  root: TableDef,
  relation: RelationDef,
  extra?: ExpressionNode
): ExpressionNode => {
  const base = baseRelationCondition(root, relation);
  return extra ? and(base, extra) : base;
};

export const buildRelationCorrelation = (root: TableDef, relation: RelationDef): ExpressionNode => {
  return baseRelationCondition(root, relation);
};
