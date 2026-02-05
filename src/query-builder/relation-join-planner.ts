import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { SelectQueryState } from './select-query-state.js';
import { TableSourceNode } from '../core/ast/query.js';
import { ExpressionNode } from '../core/ast/expression.js';
import { JoinKind } from '../core/sql/sql.js';
import { addRelationJoin } from './relation-join-strategies.js';

export class RelationJoinPlanner {
  constructor(
    private readonly table: TableDef
  ) {}

  withJoin(
    state: SelectQueryState,
    relationName: string,
    relation: RelationDef,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode,
    tableSource?: TableSourceNode
  ): SelectQueryState {
    const rootAlias = state.ast.from.type === 'Table' ? state.ast.from.alias : undefined;
    return addRelationJoin({
      state,
      rootTable: this.table,
      rootAlias,
      relationKey: relationName,
      relation,
      joinKind,
      filter: extraCondition,
      tableSource
    });
  }
}
