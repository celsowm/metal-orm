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
import { findPrimaryKey } from './hydration-planner';
import { RelationProjectionHelper } from './relation-projection-helper';
import type { RelationResult } from './relation-projection-helper';
import { buildRelationJoinCondition, buildRelationCorrelation } from './relation-conditions';
import { JoinKind, JOIN_KINDS } from '../constants/sql';

/**
 * Join kinds supported for relation inclusion
 */
type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;

/**
 * Service for handling relation operations (joins, includes, etc.)
 */
export class RelationService {
  private readonly projectionHelper: RelationProjectionHelper;

  /**
   * Creates a new RelationService instance
   * @param table - Table definition
   * @param state - Current query state
   * @param hydration - Hydration manager
   */
  constructor(
    private readonly table: TableDef,
    private readonly state: SelectQueryState,
    private readonly hydration: HydrationManager
  ) {
    this.projectionHelper = new RelationProjectionHelper(table, (state, hydration, columns) =>
      this.selectColumns(state, hydration, columns)
    );
  }

  /**
   * Joins a relation to the query
   * @param relationName - Name of the relation to join
   * @param joinKind - Type of join to use
   * @param extraCondition - Additional join condition
   * @returns Relation result with updated state and hydration
   */
  joinRelation(
    relationName: string,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode
  ): RelationResult {
    const nextState = this.withJoin(this.state, relationName, joinKind, extraCondition);
    return { state: nextState, hydration: this.hydration };
  }

  /**
   * Matches records based on a relation with an optional predicate
   * @param relationName - Name of the relation to match
   * @param predicate - Optional predicate expression
   * @returns Relation result with updated state and hydration
   */
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

  /**
   * Includes a relation in the query result
   * @param relationName - Name of the relation to include
   * @param options - Options for relation inclusion
   * @returns Relation result with updated state and hydration
   */
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

    const projectionResult = this.projectionHelper.ensureBaseProjection(state, hydration);
    state = projectionResult.state;
    hydration = projectionResult.hydration;

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

  /**
   * Applies relation correlation to a query AST
   * @param relationName - Name of the relation
   * @param ast - Query AST to modify
   * @returns Modified query AST with relation correlation
   */
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

  /**
   * Creates a join node for a relation
   * @param state - Current query state
   * @param relationName - Name of the relation
   * @param joinKind - Type of join to use
   * @param extraCondition - Additional join condition
   * @returns Updated query state with join
   */
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

  /**
   * Selects columns for a relation
   * @param state - Current query state
   * @param hydration - Hydration manager
   * @param columns - Columns to select
   * @returns Relation result with updated state and hydration
   */
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

  /**
   * Gets a relation definition by name
   * @param relationName - Name of the relation
   * @returns Relation definition
   * @throws Error if relation is not found
   */
  private getRelation(relationName: string): RelationDef {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    return relation;
  }

  /**
   * Creates a QueryAstService instance
   * @param state - Current query state
   * @returns QueryAstService instance
   */
  private astService(state: SelectQueryState = this.state): QueryAstService {
    return new QueryAstService(this.table, state);
  }
}

export type { RelationResult } from './relation-projection-helper';
