import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, HydrationPlan } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  LiteralNode,
  BinaryExpressionNode,
  CaseExpressionNode,
  WindowFunctionNode,
  exists,
  notExists
} from '../ast/expression';
import { CompiledQuery, Dialect } from '../dialect/abstract';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import {
  defaultSelectQueryBuilderDependencies,
  SelectQueryBuilderContext,
  SelectQueryBuilderDependencies,
  SelectQueryBuilderEnvironment
} from './select-query-builder-deps';
import { ColumnSelector } from './operations/column-selector';
import { CteManager } from './operations/cte-manager';
import { JoinManager } from './operations/join-manager';
import { FilterManager } from './operations/filter-manager';
import { PaginationManager } from './operations/pagination-manager';
import { RelationManager, RelationIncludeOptions } from './operations/relation-manager';
import { JOIN_KINDS, JoinKind, ORDER_DIRECTIONS, OrderDirection } from '../constants/sql';

/**
 * Main query builder class for constructing SQL SELECT queries
 * @typeParam T - Type of the result data
 */
export class SelectQueryBuilder<T> {
  private readonly env: SelectQueryBuilderEnvironment;
  private readonly context: SelectQueryBuilderContext;
  private readonly columnSelector: ColumnSelector;
  private readonly cteManager: CteManager;
  private readonly joinManager: JoinManager;
  private readonly filterManager: FilterManager;
  private readonly paginationManager: PaginationManager;
  private readonly relationManager: RelationManager;

  /**
   * Creates a new SelectQueryBuilder instance
   * @param table - Table definition to query
   * @param state - Optional initial query state
   * @param hydration - Optional hydration manager
   * @param dependencies - Optional query builder dependencies
   */
  constructor(
    table: TableDef,
    state?: SelectQueryState,
    hydration?: HydrationManager,
    dependencies?: SelectQueryBuilderDependencies
  ) {
    const deps = dependencies ?? defaultSelectQueryBuilderDependencies;
    this.env = { table, deps };
    const initialState = state ?? deps.createState(table);
    const initialHydration = hydration ?? deps.createHydration(table);
    this.context = {
      state: initialState,
      hydration: initialHydration
    };
    this.columnSelector = new ColumnSelector(this.env);
    this.cteManager = new CteManager(this.env);
    this.joinManager = new JoinManager(this.env);
    this.filterManager = new FilterManager(this.env);
    this.paginationManager = new PaginationManager(this.env);
    this.relationManager = new RelationManager(this.env);
  }

  private clone(context: SelectQueryBuilderContext = this.context): SelectQueryBuilder<T> {
    return new SelectQueryBuilder(this.env.table, context.state, context.hydration, this.env.deps);
  }

  private resolveQueryNode(query: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryNode {
    return typeof (query as any).getAST === 'function'
      ? (query as SelectQueryBuilder<any>).getAST()
      : (query as SelectQueryNode);
  }

  private createChildBuilder<R>(table: TableDef): SelectQueryBuilder<R> {
    return new SelectQueryBuilder(table, undefined, undefined, this.env.deps);
  }

  /**
   * Selects specific columns for the query
   * @param columns - Record of column definitions, function nodes, case expressions, or window functions
   * @returns New query builder instance with selected columns
   */
  select(columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.select(this.context, columns));
  }

  /**
   * Selects raw column expressions
   * @param cols - Column expressions as strings
   * @returns New query builder instance with raw column selections
   */
  selectRaw(...cols: string[]): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.selectRaw(this.context, cols));
  }

  /**
   * Adds a Common Table Expression (CTE) to the query
   * @param name - Name of the CTE
   * @param query - Query builder or query node for the CTE
   * @param columns - Optional column names for the CTE
   * @returns New query builder instance with the CTE
   */
  with(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextContext = this.cteManager.withCte(this.context, name, subAst, columns, false);
    return this.clone(nextContext);
  }

  /**
   * Adds a recursive Common Table Expression (CTE) to the query
   * @param name - Name of the CTE
   * @param query - Query builder or query node for the CTE
   * @param columns - Optional column names for the CTE
   * @returns New query builder instance with the recursive CTE
   */
  withRecursive(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextContext = this.cteManager.withCte(this.context, name, subAst, columns, true);
    return this.clone(nextContext);
  }

  /**
   * Selects a subquery as a column
   * @param alias - Alias for the subquery column
   * @param sub - Query builder or query node for the subquery
   * @returns New query builder instance with the subquery selection
   */
  selectSubquery(alias: string, sub: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const query = this.resolveQueryNode(sub);
    return this.clone(this.columnSelector.selectSubquery(this.context, alias, query));
  }

  /**
   * Adds an INNER JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the INNER JOIN
   */
  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.INNER);
    return this.clone(nextContext);
  }

  /**
   * Adds a LEFT JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the LEFT JOIN
   */
  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.LEFT);
    return this.clone(nextContext);
  }

  /**
   * Adds a RIGHT JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the RIGHT JOIN
   */
  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.RIGHT);
    return this.clone(nextContext);
  }

  /**
   * Matches records based on a relationship
   * @param relationName - Name of the relationship to match
   * @param predicate - Optional predicate expression
   * @returns New query builder instance with the relationship match
   */
  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.match(this.context, relationName, predicate);
    return this.clone(nextContext);
  }

  /**
   * Joins a related table
   * @param relationName - Name of the relationship to join
   * @param joinKind - Type of join (defaults to INNER)
   * @param extraCondition - Optional additional join condition
   * @returns New query builder instance with the relationship join
   */
  joinRelation(
    relationName: string,
    joinKind: JoinKind = JOIN_KINDS.INNER,
    extraCondition?: ExpressionNode
  ): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.joinRelation(this.context, relationName, joinKind, extraCondition);
    return this.clone(nextContext);
  }

  /**
   * Includes related data in the query results
   * @param relationName - Name of the relationship to include
   * @param options - Optional include options
   * @returns New query builder instance with the relationship inclusion
   */
  include(relationName: string, options?: RelationIncludeOptions): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.include(this.context, relationName, options);
    return this.clone(nextContext);
  }

  /**
   * Adds a WHERE condition to the query
   * @param expr - Expression for the WHERE clause
   * @returns New query builder instance with the WHERE condition
   */
  where(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.where(this.context, expr);
    return this.clone(nextContext);
  }

  /**
   * Adds a GROUP BY clause to the query
   * @param col - Column definition or column node to group by
   * @returns New query builder instance with the GROUP BY clause
   */
  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.groupBy(this.context, col);
    return this.clone(nextContext);
  }

  /**
   * Adds a HAVING condition to the query
   * @param expr - Expression for the HAVING clause
   * @returns New query builder instance with the HAVING condition
   */
  having(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.having(this.context, expr);
    return this.clone(nextContext);
  }

  /**
   * Adds an ORDER BY clause to the query
   * @param col - Column definition or column node to order by
   * @param direction - Order direction (defaults to ASC)
   * @returns New query builder instance with the ORDER BY clause
   */
  orderBy(col: ColumnDef | ColumnNode, direction: OrderDirection = ORDER_DIRECTIONS.ASC): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.orderBy(this.context, col, direction);
    return this.clone(nextContext);
  }

  /**
   * Adds a DISTINCT clause to the query
   * @param cols - Columns to make distinct
   * @returns New query builder instance with the DISTINCT clause
   */
  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.distinct(this.context, cols));
  }

  /**
   * Adds a LIMIT clause to the query
   * @param n - Maximum number of rows to return
   * @returns New query builder instance with the LIMIT clause
   */
  limit(n: number): SelectQueryBuilder<T> {
    const nextContext = this.paginationManager.limit(this.context, n);
    return this.clone(nextContext);
  }

  /**
   * Adds an OFFSET clause to the query
   * @param n - Number of rows to skip
   * @returns New query builder instance with the OFFSET clause
   */
  offset(n: number): SelectQueryBuilder<T> {
    const nextContext = this.paginationManager.offset(this.context, n);
    return this.clone(nextContext);
  }

  /**
   * Adds a WHERE EXISTS condition to the query
   * @param subquery - Subquery to check for existence
   * @returns New query builder instance with the WHERE EXISTS condition
   */
  whereExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(subquery);
    return this.where(exists(subAst));
  }

  /**
   * Adds a WHERE NOT EXISTS condition to the query
   * @param subquery - Subquery to check for non-existence
   * @returns New query builder instance with the WHERE NOT EXISTS condition
   */
  whereNotExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(subquery);
    return this.where(notExists(subAst));
  }

  /**
   * Adds a WHERE EXISTS condition based on a relationship
   * @param relationName - Name of the relationship to check
   * @param callback - Optional callback to modify the relationship query
   * @returns New query builder instance with the relationship existence check
   */
  whereHas(
    relationName: string,
    callback?: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>
  ): SelectQueryBuilder<T> {
    const relation = this.env.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);
    }

    let subQb = this.createChildBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const finalSubAst = this.relationManager.applyRelationCorrelation(this.context, relationName, subAst);
    return this.where(exists(finalSubAst));
  }

  /**
   * Adds a WHERE NOT EXISTS condition based on a relationship
   * @param relationName - Name of the relationship to check
   * @param callback - Optional callback to modify the relationship query
   * @returns New query builder instance with the relationship non-existence check
   */
  whereHasNot(
    relationName: string,
    callback?: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>
  ): SelectQueryBuilder<T> {
    const relation = this.env.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);
    }

    let subQb = this.createChildBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const finalSubAst = this.relationManager.applyRelationCorrelation(this.context, relationName, subAst);
    return this.where(notExists(finalSubAst));
  }

  /**
   * Compiles the query to SQL for a specific dialect
   * @param dialect - Database dialect to compile for
   * @returns Compiled query with SQL and parameters
   */
  compile(dialect: Dialect): CompiledQuery {
    return dialect.compileSelect(this.context.state.ast);
  }

  /**
   * Converts the query to SQL string for a specific dialect
   * @param dialect - Database dialect to generate SQL for
   * @returns SQL string representation of the query
   */
  toSql(dialect: Dialect): string {
    return this.compile(dialect).sql;
  }

  /**
   * Gets the hydration plan for the query
   * @returns Hydration plan or undefined if none exists
   */
  getHydrationPlan(): HydrationPlan | undefined {
    return this.context.hydration.getPlan();
  }

  /**
   * Gets the Abstract Syntax Tree (AST) representation of the query
   * @returns Query AST with hydration applied
   */
  getAST(): SelectQueryNode {
    return this.context.hydration.applyToAst(this.context.state.ast);
  }
}

/**
 * Creates a column node for use in expressions
 * @param table - Table name
 * @param name - Column name
 * @returns ColumnNode with the specified table and name
 */
export const createColumn = (table: string, name: string): ColumnNode => ({ type: 'Column', table, name });

/**
 * Creates a literal value node for use in expressions
 * @param val - Literal value (string or number)
 * @returns LiteralNode with the specified value
 */
export const createLiteral = (val: string | number): LiteralNode => ({ type: 'Literal', value: val });
