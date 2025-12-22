import { TableDef } from '../schema/table.js';
import { RelationDef, RelationKinds, BelongsToManyRelation } from '../schema/relation.js';
import { SelectQueryState } from './select-query-state.js';
import { QueryAstService } from './query-ast-service.js';
import { TableSourceNode } from '../core/ast/query.js';
import { ExpressionNode } from '../core/ast/expression.js';
import { JoinKind } from '../core/sql/sql.js';
import { buildRelationJoinCondition, buildBelongsToManyJoins } from './relation-conditions.js';
import { createJoinNode } from '../core/ast/join-node.js';

export class RelationJoinPlanner {
  constructor(
    private readonly table: TableDef,
    private readonly createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService
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
    if (relation.type === RelationKinds.BelongsToMany) {
      const targetTableSource: TableSourceNode = tableSource ?? {
        type: 'Table',
        name: relation.target.name,
        schema: relation.target.schema
      };
      const targetName = this.resolveTargetTableName(targetTableSource, relation);
      const joins = buildBelongsToManyJoins(
        this.table,
        relationName,
        relation as BelongsToManyRelation,
        joinKind,
        extraCondition,
        rootAlias,
        targetTableSource,
        targetName
      );
      return joins.reduce((current, join) => this.astService(current).withJoin(join), state);
    }

    const targetTable: TableSourceNode = tableSource ?? {
      type: 'Table',
      name: relation.target.name,
      schema: relation.target.schema
    };
    const targetName = this.resolveTargetTableName(targetTable, relation);
    const condition = buildRelationJoinCondition(
      this.table,
      relation,
      extraCondition,
      rootAlias,
      targetName
    );
    const joinNode = createJoinNode(joinKind, targetTable, condition, relationName);

    return this.astService(state).withJoin(joinNode);
  }

  private astService(state: SelectQueryState): QueryAstService {
    return this.createQueryAstService(this.table, state);
  }

  private resolveTargetTableName(target: TableSourceNode, relation: RelationDef): string {
    if (target.type === 'Table') {
      return target.alias ?? target.name;
    }
    if (target.type === 'DerivedTable') {
      return target.alias;
    }
    if (target.type === 'FunctionTable') {
      return target.alias ?? relation.target.name;
    }
    return relation.target.name;
  }
}
