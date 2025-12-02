import { TableDef } from '../schema/table';
import { RelationDef } from '../schema/relation';
import { ExpressionNode, eq, and } from '../ast/expression';

const baseRelationCondition = (root: TableDef, relation: RelationDef): ExpressionNode => {
  if (relation.type === 'HAS_MANY') {
    return eq(
      { type: 'Column', table: relation.target.name, name: relation.foreignKey },
      { type: 'Column', table: root.name, name: relation.localKey || 'id' }
    );
  }

  return eq(
    { type: 'Column', table: relation.target.name, name: relation.localKey || 'id' },
    { type: 'Column', table: root.name, name: relation.foreignKey }
  );
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
