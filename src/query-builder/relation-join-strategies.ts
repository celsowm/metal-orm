import { ExpressionNode, and, eq } from '../core/ast/expression.js';
import type { JoinNode } from '../core/ast/join.js';
import { createJoinNode } from '../core/ast/join-node.js';
import type { TableSourceNode } from '../core/ast/query.js';
import { JoinKind } from '../core/sql/sql.js';
import { RelationDef, RelationKinds, type BelongsToManyRelation } from '../schema/relation.js';
import type { TableDef } from '../schema/table.js';
import { findPrimaryKey } from './hydration-planner.js';
import { buildBelongsToManyJoins, buildRelationJoinCondition } from './relation-conditions.js';
import { remapExpressionTable } from './expression-table-mapper.js';
import { RelationIncludeOptions } from './relation-types.js';
import { SelectQueryState } from './select-query-state.js';
import { ensureCorrelationName, resolveTargetTableName } from './table-alias-utils.js';

const buildBelongsToManyTargetCondition = (
  relation: BelongsToManyRelation,
  targetName: string,
  extra?: ExpressionNode
): ExpressionNode => {
  const targetKey = relation.targetKey || findPrimaryKey(relation.target);
  let condition: ExpressionNode = eq(
    { type: 'Column', table: targetName, name: targetKey },
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToTarget }
  );
  if (extra) {
    condition = and(condition, extra);
  }
  return condition;
};

type AddRelationJoinParams = {
  state: SelectQueryState;
  rootTable: TableDef;
  rootAlias: string | undefined;
  relationKey: string;
  relation: RelationDef;
  joinKind: JoinKind;
  filter?: ExpressionNode;
  tableSource?: TableSourceNode;
};

export const addRelationJoin = (params: AddRelationJoinParams): SelectQueryState => {
  const { state, rootTable, rootAlias, relationKey, relation, joinKind, filter, tableSource } = params;
  if (relation.type === RelationKinds.BelongsToMany) {
    const many = relation as BelongsToManyRelation;
    let targetSource: TableSourceNode = tableSource ?? {
      type: 'Table',
      name: relation.target.name,
      schema: relation.target.schema
    };
    targetSource = ensureCorrelationName(state, relationKey, targetSource, [many.pivotTable.name]);
    const targetName = resolveTargetTableName(targetSource, relation.target.name);
    const extra = remapExpressionTable(filter, relation.target.name, targetName);
    const joins = buildBelongsToManyJoins(
      rootTable,
      relationKey,
      many,
      joinKind,
      extra,
      rootAlias,
      targetSource,
      targetName
    );
    return joins.reduce((curr, join) => curr.withJoin(join), state);
  }

  let targetSource: TableSourceNode = tableSource ?? {
    type: 'Table',
    name: relation.target.name,
    schema: relation.target.schema
  };
  targetSource = ensureCorrelationName(state, relationKey, targetSource);
  const targetName = resolveTargetTableName(targetSource, relation.target.name);
  const extra = remapExpressionTable(filter, relation.target.name, targetName);
  const condition = buildRelationJoinCondition(rootTable, relation, extra, rootAlias, targetName);
  const joinNode = createJoinNode(joinKind, targetSource, condition, relationKey);
  return state.withJoin(joinNode);
};

type UpdateRelationJoinParams = {
  joins: JoinNode[];
  joinIndex: number;
  relation: RelationDef;
  currentTable: TableDef;
  currentAlias: string | undefined;
  options: RelationIncludeOptions;
};

export const updateRelationJoin = (params: UpdateRelationJoinParams): JoinNode[] => {
  const { joins, joinIndex, relation, currentTable, currentAlias, options } = params;
  const join = joins[joinIndex];
  const targetName = resolveTargetTableName(join.table, relation.target.name);
  const extra = remapExpressionTable(options.filter, relation.target.name, targetName);

  if (relation.type === RelationKinds.BelongsToMany) {
    const many = relation as BelongsToManyRelation;
    const targetCondition = buildBelongsToManyTargetCondition(many, targetName, extra);
    joins[joinIndex] = {
      ...join,
      kind: options.joinKind ?? join.kind,
      condition: targetCondition
    };
    if (options.joinKind && joinIndex > 0) {
      const pivotJoin = joins[joinIndex - 1];
      const pivotTable = pivotJoin.table.type === 'Table' ? pivotJoin.table.name : undefined;
      if (pivotTable === many.pivotTable.name) {
        joins[joinIndex - 1] = { ...pivotJoin, kind: options.joinKind };
      }
    }
    return joins;
  }

  const condition = buildRelationJoinCondition(currentTable, relation, extra, currentAlias, targetName);
  joins[joinIndex] = {
    ...join,
    kind: options.joinKind ?? join.kind,
    condition
  };
  return joins;
};
