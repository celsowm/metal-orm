import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import { RelationDef } from '../schema/relation.js';
import { SelectQueryNode, TableSourceNode, TableNode } from '../core/ast/query.js';
import { ColumnNode, ExpressionNode, and } from '../core/ast/expression.js';
import { SelectQueryState } from './select-query-state.js';
import { HydrationManager } from './hydration-manager.js';
import { QueryAstService } from './query-ast-service.js';
import { findPrimaryKey } from './hydration-planner.js';
import { RelationProjectionHelper } from './relation-projection-helper.js';
import type { RelationResult } from './relation-projection-helper.js';
import { buildRelationCorrelation } from './relation-conditions.js';
import { JoinKind, JOIN_KINDS } from '../core/sql/sql.js';
import { RelationIncludeOptions } from './relation-types.js';
import { getJoinRelationName } from '../core/ast/join-metadata.js';
import { splitFilterExpressions } from './relation-filter-utils.js';
import { RelationJoinPlanner } from './relation-join-planner.js';
import { RelationCteBuilder } from './relation-cte-builder.js';
import { relationIncludeStrategies } from './relation-include-strategies.js';

/**
 * Service for handling relation operations (joins, includes, etc.)
 */
export class RelationService {
  private readonly projectionHelper: RelationProjectionHelper;
  private readonly joinPlanner: RelationJoinPlanner;
  private readonly cteBuilder: RelationCteBuilder;

  /**
   * Creates a new RelationService instance
   * @param table - Table definition
   * @param state - Current query state
   * @param hydration - Hydration manager
   */
  constructor(
    private readonly table: TableDef,
    private readonly state: SelectQueryState,
    private readonly hydration: HydrationManager,
    private readonly createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService
  ) {
    this.projectionHelper = new RelationProjectionHelper(table, (state, hydration, columns) =>
      this.selectColumns(state, hydration, columns)
    );
    this.joinPlanner = new RelationJoinPlanner(table, createQueryAstService);
    this.cteBuilder = new RelationCteBuilder(table, createQueryAstService);
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
    extraCondition?: ExpressionNode,
    tableSource?: TableSourceNode
  ): RelationResult {
    const relation = this.getRelation(relationName);
    const nextState = this.joinPlanner.withJoin(
      this.state,
      relationName,
      relation,
      joinKind,
      extraCondition,
      tableSource
    );
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
    const distinctCols: ColumnNode[] = [{ type: 'Column', table: this.rootTableName(), name: pk }];
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
  include(relationName: string, options?: RelationIncludeOptions): RelationResult {
    let state = this.state;
    let hydration = this.hydration;

    const relation = this.getRelation(relationName);
    const aliasPrefix = options?.aliasPrefix ?? relationName;
    const alreadyJoined = state.ast.joins.some(j => getJoinRelationName(j) === relationName);
    const { selfFilters, crossFilters } = splitFilterExpressions(
      options?.filter,
      new Set([relation.target.name])
    );
    const canUseCte = !alreadyJoined && selfFilters.length > 0;
    const joinFilters = [...crossFilters];
    if (!canUseCte) {
      joinFilters.push(...selfFilters);
    }
    const joinCondition = this.combineWithAnd(joinFilters);

    let tableSourceOverride: TableNode | undefined;
    if (canUseCte) {
      const predicate = this.combineWithAnd(selfFilters);
      const cteInfo = this.cteBuilder.createFilteredRelationCte(
        state,
        relationName,
        relation,
        predicate
      );
      state = cteInfo.state;
      tableSourceOverride = cteInfo.table;
    }

    if (!alreadyJoined) {
      state = this.joinPlanner.withJoin(
        state,
        relationName,
        relation,
        options?.joinKind ?? JOIN_KINDS.LEFT,
        joinCondition,
        tableSourceOverride
      );
    }

    const projectionResult = this.projectionHelper.ensureBaseProjection(state, hydration);
    state = projectionResult.state;
    hydration = projectionResult.hydration;

    const strategy = relationIncludeStrategies[relation.type];
    const result = strategy({
      rootTable: this.table,
      state,
      hydration,
      relation,
      relationName,
      aliasPrefix,
      options,
      selectColumns: (nextState, nextHydration, columns) =>
        this.selectColumns(nextState, nextHydration, columns)
    });

    return { state: result.state, hydration: result.hydration };
  }

  /**
   * Applies relation correlation to a query AST
   * @param relationName - Name of the relation
   * @param ast - Query AST to modify
   * @returns Modified query AST with relation correlation
   */
  applyRelationCorrelation(
    relationName: string,
    ast: SelectQueryNode,
    additionalCorrelation?: ExpressionNode
  ): SelectQueryNode {
    const relation = this.getRelation(relationName);
    const rootAlias = this.state.ast.from.type === 'Table' ? this.state.ast.from.alias : undefined;
    let correlation = buildRelationCorrelation(this.table, relation, rootAlias);
    if (additionalCorrelation) {
      correlation = and(correlation, additionalCorrelation);
    }
    const whereInSubquery = ast.where
      ? and(correlation, ast.where)
      : correlation;

    return {
      ...ast,
      where: whereInSubquery
    };
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


  private combineWithAnd(expressions: ExpressionNode[]): ExpressionNode | undefined {
    if (expressions.length === 0) return undefined;
    if (expressions.length === 1) return expressions[0];
    return {
      type: 'LogicalExpression',
      operator: 'AND',
      operands: expressions
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
    return this.createQueryAstService(this.table, state);
  }

  private rootTableName(): string {
    const from = this.state.ast.from;
    if (from.type === 'Table' && from.alias) return from.alias;
    return this.table.name;
  }
}

export type { RelationResult } from './relation-projection-helper.js';

