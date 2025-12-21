import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import {
  RelationDef,
  RelationKinds,
  BelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  BelongsToRelation
} from '../schema/relation.js';
import { SelectQueryNode, TableSourceNode, TableNode, OrderingTerm } from '../core/ast/query.js';
import {
  ColumnNode,
  ExpressionNode,
  OperandNode,
  and,
  isOperandNode
} from '../core/ast/expression.js';
import { SelectQueryState } from './select-query-state.js';
import { HydrationManager } from './hydration-manager.js';
import { QueryAstService } from './query-ast-service.js';
import { findPrimaryKey } from './hydration-planner.js';
import { RelationProjectionHelper } from './relation-projection-helper.js';
import type { RelationResult } from './relation-projection-helper.js';
import {
  buildRelationJoinCondition,
  buildRelationCorrelation,
  buildBelongsToManyJoins
} from './relation-conditions.js';
import { JoinKind, JOIN_KINDS } from '../core/sql/sql.js';
import { RelationIncludeOptions } from './relation-types.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { getJoinRelationName } from '../core/ast/join-metadata.js';
import { makeRelationAlias } from './relation-alias.js';
import { buildDefaultPivotColumns } from './relation-utils.js';

type FilterTableCollector = {
  tables: Set<string>;
  hasSubquery: boolean;
};

type RelationWithForeignKey =
  | HasManyRelation
  | HasOneRelation
  | BelongsToRelation;

const hasRelationForeignKey = (relation: RelationDef): relation is RelationWithForeignKey =>
  relation.type !== RelationKinds.BelongsToMany;

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
    private readonly hydration: HydrationManager,
    private readonly createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService
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
    extraCondition?: ExpressionNode,
    tableSource?: TableSourceNode
  ): RelationResult {
    const nextState = this.withJoin(this.state, relationName, joinKind, extraCondition, tableSource);
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
    const { selfFilters, crossFilters } = this.splitFilterExpressions(
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
      const cteInfo = this.createFilteredRelationCte(state, relationName, relation, selfFilters);
      state = cteInfo.state;
      tableSourceOverride = cteInfo.table;
    }

    if (!alreadyJoined) {
      state = this.withJoin(
        state,
        relationName,
        options?.joinKind ?? JOIN_KINDS.LEFT,
        joinCondition,
        tableSourceOverride
      );
    }

    const projectionResult = this.projectionHelper.ensureBaseProjection(state, hydration);
    state = projectionResult.state;
    hydration = projectionResult.hydration;

    if (hasRelationForeignKey(relation)) {
      const fkColumn = this.table.columns[relation.foreignKey];
      if (fkColumn) {
        const hasForeignKeySelected = state.ast.columns.some(col => {
          if ((col as ColumnNode).type !== 'Column') return false;
          const node = col as ColumnNode;
          const alias = node.alias ?? node.name;
          return alias === relation.foreignKey;
        });

        if (!hasForeignKeySelected) {
          const fkSelectionResult = this.selectColumns(state, hydration, {
            [relation.foreignKey]: fkColumn
          });
          state = fkSelectionResult.state;
          hydration = fkSelectionResult.hydration;
        }
      }
    }

    const requestedColumns = options?.columns?.length
      ? [...options.columns]
      : Object.keys(relation.target.columns);
    const targetPrimaryKey = findPrimaryKey(relation.target);
    if (!requestedColumns.includes(targetPrimaryKey)) {
      requestedColumns.push(targetPrimaryKey);
    }
    const targetColumns = requestedColumns;

    const buildTypedSelection = (
      columns: Record<string, ColumnDef>,
      prefix: string,
      keys: string[],
      missingMsg: (col: string) => string
    ): Record<string, ColumnDef> => {
      return keys.reduce((acc, key) => {
        const def = columns[key];
        if (!def) {
          throw new Error(missingMsg(key));
        }
        acc[makeRelationAlias(prefix, key)] = def;
        return acc;
      }, {} as Record<string, ColumnDef>);
    };

    const targetSelection = buildTypedSelection(
      relation.target.columns as Record<string, ColumnDef>,
      aliasPrefix,
      targetColumns,
      key => `Column '${key}' not found on relation '${relationName}'`
    );

    if (relation.type !== RelationKinds.BelongsToMany) {
      const relationSelectionResult = this.selectColumns(state, hydration, targetSelection);
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

    const many = relation as BelongsToManyRelation;
    const pivotAliasPrefix = options?.pivot?.aliasPrefix ?? `${aliasPrefix}_pivot`;
    const pivotPk = many.pivotPrimaryKey || findPrimaryKey(many.pivotTable);
    const pivotColumns =
      options?.pivot?.columns ??
      many.defaultPivotColumns ??
      buildDefaultPivotColumns(many, pivotPk);

    const pivotSelection = buildTypedSelection(
      many.pivotTable.columns as Record<string, ColumnDef>,
      pivotAliasPrefix,
      pivotColumns,
      key => `Column '${key}' not found on pivot table '${many.pivotTable.name}'`
    );

    const combinedSelection = {
      ...targetSelection,
      ...pivotSelection
    };

    const relationSelectionResult = this.selectColumns(state, hydration, combinedSelection);
    state = relationSelectionResult.state;
    hydration = relationSelectionResult.hydration;

    hydration = hydration.onRelationIncluded(
      state,
      relation,
      relationName,
      aliasPrefix,
      targetColumns,
      { aliasPrefix: pivotAliasPrefix, columns: pivotColumns }
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
    extraCondition?: ExpressionNode,
    tableSource?: TableSourceNode
  ): SelectQueryState {
    const relation = this.getRelation(relationName);
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

  private splitFilterExpressions(
    filter: ExpressionNode | undefined,
    allowedTables: Set<string>
  ): { selfFilters: ExpressionNode[]; crossFilters: ExpressionNode[] } {
    const terms = this.flattenAnd(filter);
    const selfFilters: ExpressionNode[] = [];
    const crossFilters: ExpressionNode[] = [];

    for (const term of terms) {
      if (this.isExpressionSelfContained(term, allowedTables)) {
        selfFilters.push(term);
      } else {
        crossFilters.push(term);
      }
    }

    return { selfFilters, crossFilters };
  }

  private flattenAnd(node?: ExpressionNode): ExpressionNode[] {
    if (!node) return [];
    if (node.type === 'LogicalExpression' && node.operator === 'AND') {
      return node.operands.flatMap(operand => this.flattenAnd(operand));
    }
    return [node];
  }

  private isExpressionSelfContained(expr: ExpressionNode, allowedTables: Set<string>): boolean {
    const collector = this.collectReferencedTables(expr);
    if (collector.hasSubquery) return false;
    if (collector.tables.size === 0) return true;
    for (const table of collector.tables) {
      if (!allowedTables.has(table)) {
        return false;
      }
    }
    return true;
  }

  private collectReferencedTables(expr: ExpressionNode): FilterTableCollector {
    const collector: FilterTableCollector = {
      tables: new Set(),
      hasSubquery: false
    };
    this.collectFromExpression(expr, collector);
    return collector;
  }

  private collectFromExpression(expr: ExpressionNode, collector: FilterTableCollector): void {
    switch (expr.type) {
      case 'BinaryExpression':
        this.collectFromOperand(expr.left, collector);
        this.collectFromOperand(expr.right, collector);
        break;
      case 'LogicalExpression':
        expr.operands.forEach(operand => this.collectFromExpression(operand, collector));
        break;
      case 'NullExpression':
        this.collectFromOperand(expr.left, collector);
        break;
      case 'InExpression':
        this.collectFromOperand(expr.left, collector);
        if (Array.isArray(expr.right)) {
          expr.right.forEach(value => this.collectFromOperand(value, collector));
        } else {
          collector.hasSubquery = true;
        }
        break;
      case 'ExistsExpression':
        collector.hasSubquery = true;
        break;
      case 'BetweenExpression':
        this.collectFromOperand(expr.left, collector);
        this.collectFromOperand(expr.lower, collector);
        this.collectFromOperand(expr.upper, collector);
        break;
      case 'ArithmeticExpression':
      case 'BitwiseExpression':
        this.collectFromOperand(expr.left, collector);
        this.collectFromOperand(expr.right, collector);
        break;
      default:
        break;
    }
  }

  private collectFromOperand(node: OperandNode, collector: FilterTableCollector): void {
    switch (node.type) {
      case 'Column':
        collector.tables.add(node.table);
        break;
      case 'Function':
        node.args.forEach(arg => this.collectFromOperand(arg, collector));
        if (node.separator) {
          this.collectFromOperand(node.separator, collector);
        }
        if (node.orderBy) {
          node.orderBy.forEach(order => this.collectFromOrderingTerm(order.term, collector));
        }
        break;
      case 'JsonPath':
        this.collectFromOperand(node.column, collector);
        break;
      case 'ScalarSubquery':
        collector.hasSubquery = true;
        break;
      case 'CaseExpression':
        node.conditions.forEach(({ when, then }) => {
          this.collectFromExpression(when, collector);
          this.collectFromOperand(then, collector);
        });
        if (node.else) {
          this.collectFromOperand(node.else, collector);
        }
        break;
      case 'Cast':
        this.collectFromOperand(node.expression, collector);
        break;
      case 'WindowFunction':
        node.args.forEach(arg => this.collectFromOperand(arg, collector));
        node.partitionBy?.forEach(part => this.collectFromOperand(part, collector));
        node.orderBy?.forEach(order => this.collectFromOrderingTerm(order.term, collector));
        break;
      case 'Collate':
        this.collectFromOperand(node.expression, collector);
        break;
      case 'ArithmeticExpression':
      case 'BitwiseExpression':
        this.collectFromOperand(node.left, collector);
        this.collectFromOperand(node.right, collector);
        break;
      case 'Literal':
      case 'AliasRef':
        break;
      default:
        break;
    }
  }

  private collectFromOrderingTerm(term: OrderingTerm, collector: FilterTableCollector): void {
    if (isOperandNode(term)) {
      this.collectFromOperand(term, collector);
      return;
    }
    this.collectFromExpression(term, collector);
  }

  private createFilteredRelationCte(
    state: SelectQueryState,
    relationName: string,
    relation: RelationDef,
    filters: ExpressionNode[]
  ): { state: SelectQueryState; table: TableNode } {
    const cteName = this.generateUniqueCteName(state, relationName);
    const predicate = this.combineWithAnd(filters);
    if (!predicate) {
      throw new Error('Unable to build filter CTE without predicates.');
    }

    const columns: ColumnNode[] = Object.keys(relation.target.columns).map(name => ({
      type: 'Column',
      table: relation.target.name,
      name
    }));

    const cteQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: { type: 'Table', name: relation.target.name, schema: relation.target.schema },
      columns,
      joins: [],
      where: predicate
    };

    const nextState = this.astService(state).withCte(cteName, cteQuery);
    const tableNode: TableNode = {
      type: 'Table',
      name: cteName,
      alias: relation.target.name
    };

    return { state: nextState, table: tableNode };
  }

  private generateUniqueCteName(state: SelectQueryState, relationName: string): string {
    const existing = new Set((state.ast.ctes ?? []).map(cte => cte.name));
    let candidate = `${relationName}__filtered`;
    let suffix = 1;
    while (existing.has(candidate)) {
      candidate = `${relationName}__filtered_${suffix}`;
      suffix += 1;
    }
    return candidate;
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

