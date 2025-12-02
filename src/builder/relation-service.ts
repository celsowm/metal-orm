import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { RelationDef } from '../schema/relation';
import { SelectQueryNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  and
} from '../ast/expression';
import { JoinNode } from '../ast/join';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { QueryAstService } from './query-ast-service';
import { findPrimaryKey, isRelationAlias } from './hydration-planner';
import { buildRelationJoinCondition, buildRelationCorrelation } from './relation-conditions';
import { JoinKind, JOIN_KINDS } from '../constants/sql';

type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;

export interface RelationResult {
  state: SelectQueryState;
  hydration: HydrationManager;
}

export class RelationService {
  constructor(
    private readonly table: TableDef,
    private readonly state: SelectQueryState,
    private readonly hydration: HydrationManager
  ) {}

  joinRelation(
    relationName: string,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode
  ): RelationResult {
    const nextState = this.withJoin(this.state, relationName, joinKind, extraCondition);
    return { state: nextState, hydration: this.hydration };
  }

  match(
    relationName: string,
    predicate?: ExpressionNode
  ): RelationResult {
    const joined = this.joinRelation(relationName, JOIN_KINDS.INNER, predicate);
    const pk = findPrimaryKey(this.table);
    const distinctCols: ColumnNode[] = [{ type: 'Column', table: this.table.name, name: pk }];
    const existingDistinct = joined.state.ast.distinct ? joined.state.ast.distinct : [];
    const nextState = this.astService(joined.state).withDistinct([...existingDistinct, ...distinctCols]);
    return { state: nextState, hydration: joined.hydration };
  }

  include(
    relationName: string,
    options?: { columns?: string[]; aliasPrefix?: string; filter?: ExpressionNode; joinKind?: RelationIncludeJoinKind }
  ): RelationResult {
    let state = this.state;
    let hydration = this.hydration;

    const relation = this.getRelation(relationName);
    const aliasPrefix = options?.aliasPrefix ?? relationName;
    const alreadyJoined = state.ast.joins.some(j => j.relationName === relationName);

    if (!alreadyJoined) {
      const joined = this.joinRelation(relationName, options?.joinKind ?? JOIN_KINDS.LEFT, options?.filter);
      state = joined.state;
    }

    const primaryKey = findPrimaryKey(this.table);
    const hasPrimarySelected = state.ast.columns
      .some(col => !isRelationAlias((col as ColumnNode).alias) && ((col as ColumnNode).alias || (col as ColumnNode).name) === primaryKey);

    if (!this.hasBaseProjection(state)) {
      const baseSelection = Object.keys(this.table.columns).reduce((acc, key) => {
        acc[key] = (this.table.columns as any)[key];
        return acc;
      }, {} as Record<string, ColumnDef>);

      const selection = this.selectColumns(state, hydration, baseSelection);
      state = selection.state;
      hydration = selection.hydration;
    } else if (!hasPrimarySelected && (this.table.columns as any)[primaryKey]) {
      const primarySelection = this.selectColumns(state, hydration, {
        [primaryKey]: (this.table.columns as any)[primaryKey]
      });
      state = primarySelection.state;
      hydration = primarySelection.hydration;
    }

    const targetColumns = options?.columns?.length
      ? options.columns
      : Object.keys(relation.target.columns);

    const relationSelection = targetColumns.reduce((acc, key) => {
      const def = (relation.target.columns as any)[key];
      if (!def) {
        throw new Error(`Column '${key}' not found on relation '${relationName}'`);
      }
      acc[`${aliasPrefix}__${key}`] = def;
      return acc;
    }, {} as Record<string, ColumnDef>);

    const relationSelectionResult = this.selectColumns(state, hydration, relationSelection);
    state = relationSelectionResult.state;
    hydration = relationSelectionResult.hydration;

    hydration = hydration.onRelationIncluded(
      state,
      relation,
      relationName,
      aliasPrefix,
      targetColumns
    );

    return { state, hydration };
  }

  applyRelationCorrelation(
    relationName: string,
    ast: SelectQueryNode
  ): SelectQueryNode {
    const relation = this.getRelation(relationName);
    const correlation = buildRelationCorrelation(this.table, relation);
    const whereInSubquery = ast.where
      ? and(correlation, ast.where)
      : correlation;

    return {
      ...ast,
      where: whereInSubquery
    };
  }

  private withJoin(
    state: SelectQueryState,
    relationName: string,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode
  ): SelectQueryState {
    const relation = this.getRelation(relationName);
    const condition = buildRelationJoinCondition(this.table, relation, extraCondition);

    const joinNode: JoinNode = {
      type: 'Join',
      kind: joinKind,
      table: { type: 'Table', name: relation.target.name },
      condition,
      relationName
    };

    return this.astService(state).withJoin(joinNode);
  }

  private selectColumns(
    state: SelectQueryState,
    hydration: HydrationManager,
    columns: Record<string, ColumnDef>
  ): RelationResult {
    const { state: nextState, addedColumns } = this.astService(state).select(columns);
    return {
      state: nextState,
      hydration: hydration.onColumnsSelected(nextState, addedColumns)
    };
  }

  private hasBaseProjection(state: SelectQueryState): boolean {
    return state.ast.columns.some(col => !isRelationAlias((col as ColumnNode).alias));
  }

  private getRelation(relationName: string): RelationDef {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    return relation;
  }

  private astService(state: SelectQueryState = this.state): QueryAstService {
    return new QueryAstService(this.table, state);
  }
}
