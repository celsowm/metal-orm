import { TableDef } from '../schema/table.js';

import { ColumnDef } from '../schema/column.js';

import { SelectQueryNode, SetOperationKind } from '../core/ast/query.js';

import { HydrationPlan } from '../core/hydration/types.js';

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

} from '../core/ast/expression.js';

import { CompiledQuery, Dialect } from '../core/dialect/abstract.js';

import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';



type SelectDialectInput = Dialect | DialectKey;

import { SelectQueryState } from './select-query-state.js';

import { HydrationManager } from './hydration-manager.js';

import {

  resolveSelectQueryBuilderDependencies,

  SelectQueryBuilderContext,

  SelectQueryBuilderDependencies,

  SelectQueryBuilderEnvironment

} from './select-query-builder-deps.js';

import { QueryAstService } from './query-ast-service.js';

import { ColumnSelector } from './column-selector.js';

import { RelationManager } from './relation-manager.js';

import { RelationIncludeOptions } from './relation-types.js';

import type { RelationDef } from '../schema/relation.js';

import { JOIN_KINDS, JoinKind, ORDER_DIRECTIONS, OrderDirection } from '../core/sql/sql.js';

import { Entity, RelationMap, RelationTargetTable } from '../schema/types.js';

import { OrmSession } from '../orm/orm-session.ts';

import { ExecutionContext } from '../orm/execution-context.js';

import { HydrationContext } from '../orm/hydration-context.js';

import { executeHydrated, executeHydratedWithContexts } from '../orm/execute.js';

import { createJoinNode } from '../core/ast/join-node.js';


type ColumnSelectionValue = ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode;

type DeepSelectConfig<TTable extends TableDef> = {
  root?: (keyof TTable['columns'] & string)[];
} & {
  [K in keyof TTable['relations'] & string]?: (
    keyof RelationTargetTable<TTable['relations'][K]>['columns'] & string
  )[];
};


/**

 * Main query builder class for constructing SQL SELECT queries

 * @typeParam T - Result type for projections (unused)

 * @typeParam TTable - Table definition being queried

 */

export class SelectQueryBuilder<T = any, TTable extends TableDef = TableDef> {

  private readonly env: SelectQueryBuilderEnvironment;

  private readonly context: SelectQueryBuilderContext;

  private readonly columnSelector: ColumnSelector;

  private readonly relationManager: RelationManager;

  private readonly lazyRelations: Set<string>;



  /**

   * Creates a new SelectQueryBuilder instance

   * @param table - Table definition to query

   * @param state - Optional initial query state

   * @param hydration - Optional hydration manager

   * @param dependencies - Optional query builder dependencies

   */

  constructor(

    table: TTable,

    state?: SelectQueryState,

    hydration?: HydrationManager,

    dependencies?: Partial<SelectQueryBuilderDependencies>,

    lazyRelations?: Set<string>

  ) {

    const deps = resolveSelectQueryBuilderDependencies(dependencies);

    this.env = { table, deps };

    const initialState = state ?? deps.createState(table);

    const initialHydration = hydration ?? deps.createHydration(table);

    this.context = {

      state: initialState,

      hydration: initialHydration

    };

    this.lazyRelations = new Set(lazyRelations ?? []);

    this.columnSelector = new ColumnSelector(this.env);

    this.relationManager = new RelationManager(this.env);

  }



  private clone(

    context: SelectQueryBuilderContext = this.context,

    lazyRelations = new Set(this.lazyRelations)

  ): SelectQueryBuilder<T, TTable> {

    return new SelectQueryBuilder(this.env.table as TTable, context.state, context.hydration, this.env.deps, lazyRelations);

  }



  private resolveQueryNode(query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryNode {

    return typeof (query as any).getAST === 'function'

      ? (query as SelectQueryBuilder<any, TableDef<any>>).getAST()

      : (query as SelectQueryNode);

  }



  private createChildBuilder<R, TChild extends TableDef>(table: TChild): SelectQueryBuilder<R, TChild> {

    return new SelectQueryBuilder(table, undefined, undefined, this.env.deps);

  }



  private applyAst(

    context: SelectQueryBuilderContext,

    mutator: (service: QueryAstService) => SelectQueryState

  ): SelectQueryBuilderContext {

    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);

    const nextState = mutator(astService);

    return { state: nextState, hydration: context.hydration };

  }



  private applyJoin(

    context: SelectQueryBuilderContext,

    table: TableDef,

    condition: BinaryExpressionNode,

    kind: JoinKind

  ): SelectQueryBuilderContext {

    const joinNode = createJoinNode(kind, table.name, condition);

    return this.applyAst(context, service => service.withJoin(joinNode));

  }



  private applySetOperation(

    operator: SetOperationKind,

    query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode

  ): SelectQueryBuilderContext {

    const subAst = this.resolveQueryNode(query);

    return this.applyAst(this.context, service => service.withSetOperation(operator, subAst));

  }



  /**

   * Selects specific columns for the query

   * @param columns - Record of column definitions, function nodes, case expressions, or window functions

   * @returns New query builder instance with selected columns

   */

  select(columns: Record<string, ColumnSelectionValue>): SelectQueryBuilder<T, TTable> {

    return this.clone(this.columnSelector.select(this.context, columns));

  }


  /**
   * Selects columns from the root table by name (typed).
   * @param cols - Column names on the root table
   */
  selectColumns<K extends keyof TTable['columns'] & string>(...cols: K[]): SelectQueryBuilder<T, TTable> {
    const selection: Record<string, ColumnDef> = {};

    for (const key of cols) {
      const col = this.env.table.columns[key];
      if (!col) {
        throw new Error(`Column '${key}' not found on table '${this.env.table.name}'`);
      }
      selection[key] = col;
    }

    return this.select(selection);
  }



  /**

   * Selects raw column expressions

   * @param cols - Column expressions as strings

   * @returns New query builder instance with raw column selections

   */

  selectRaw(...cols: string[]): SelectQueryBuilder<T, TTable> {

    return this.clone(this.columnSelector.selectRaw(this.context, cols));

  }



  /**

   * Adds a Common Table Expression (CTE) to the query

   * @param name - Name of the CTE

   * @param query - Query builder or query node for the CTE

   * @param columns - Optional column names for the CTE

   * @returns New query builder instance with the CTE

   */

  with(name: string, query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T, TTable> {

    const subAst = this.resolveQueryNode(query);

    const nextContext = this.applyAst(this.context, service => service.withCte(name, subAst, columns, false));

    return this.clone(nextContext);

  }



  /**

   * Adds a recursive Common Table Expression (CTE) to the query

   * @param name - Name of the CTE

   * @param query - Query builder or query node for the CTE

   * @param columns - Optional column names for the CTE

   * @returns New query builder instance with the recursive CTE

   */

  withRecursive(name: string, query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T, TTable> {

    const subAst = this.resolveQueryNode(query);

    const nextContext = this.applyAst(this.context, service => service.withCte(name, subAst, columns, true));

    return this.clone(nextContext);

  }



  /**

   * Selects a subquery as a column

   * @param alias - Alias for the subquery column

   * @param sub - Query builder or query node for the subquery

   * @returns New query builder instance with the subquery selection

   */

  selectSubquery(alias: string, sub: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    const query = this.resolveQueryNode(sub);

    return this.clone(this.columnSelector.selectSubquery(this.context, alias, query));

  }



  /**

   * Adds an INNER JOIN to the query

   * @param table - Table to join

   * @param condition - Join condition expression

   * @returns New query builder instance with the INNER JOIN

   */

  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyJoin(this.context, table, condition, JOIN_KINDS.INNER);

    return this.clone(nextContext);

  }



  /**

   * Adds a LEFT JOIN to the query

   * @param table - Table to join

   * @param condition - Join condition expression

   * @returns New query builder instance with the LEFT JOIN

   */

  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyJoin(this.context, table, condition, JOIN_KINDS.LEFT);

    return this.clone(nextContext);

  }



  /**

   * Adds a RIGHT JOIN to the query

   * @param table - Table to join

   * @param condition - Join condition expression

   * @returns New query builder instance with the RIGHT JOIN

   */

  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyJoin(this.context, table, condition, JOIN_KINDS.RIGHT);

    return this.clone(nextContext);

  }



  /**

   * Matches records based on a relationship

   * @param relationName - Name of the relationship to match

   * @param predicate - Optional predicate expression

   * @returns New query builder instance with the relationship match

   */

  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T, TTable> {

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

  ): SelectQueryBuilder<T, TTable> {

    const nextContext = this.relationManager.joinRelation(this.context, relationName, joinKind, extraCondition);

    return this.clone(nextContext);

  }



  /**

   * Includes related data in the query results

   * @param relationName - Name of the relationship to include

   * @param options - Optional include options

   * @returns New query builder instance with the relationship inclusion

   */

  include(relationName: string, options?: RelationIncludeOptions): SelectQueryBuilder<T, TTable> {

    const nextContext = this.relationManager.include(this.context, relationName, options);

    return this.clone(nextContext);

  }



  includeLazy<K extends keyof RelationMap<TTable>>(relationName: K): SelectQueryBuilder<T, TTable> {

    const nextLazy = new Set(this.lazyRelations);

    nextLazy.add(relationName as string);

    return this.clone(this.context, nextLazy);

  }

  /**
   * Selects columns for a related table in a single hop.
   */
  selectRelationColumns<
    K extends keyof TTable['relations'] & string,
    TRel extends RelationDef = TTable['relations'][K],
    TTarget extends TableDef = RelationTargetTable<TRel>,
    C extends keyof TTarget['columns'] & string = keyof TTarget['columns'] & string
  >(relationName: K, ...cols: C[]): SelectQueryBuilder<T, TTable> {
    const relation = this.env.table.relations[relationName] as RelationDef | undefined;
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);
    }
    const target = relation.target;

    for (const col of cols) {
      if (!target.columns[col]) {
        throw new Error(
          `Column '${col}' not found on related table '${target.name}' for relation '${relationName}'`
        );
      }
    }

    return this.include(relationName as string, { columns: cols as string[] });
  }


  /**
   * Convenience alias for selecting specific columns from a relation.
   */
  includePick<
    K extends keyof TTable['relations'] & string,
    TRel extends RelationDef = TTable['relations'][K],
    TTarget extends TableDef = RelationTargetTable<TRel>,
    C extends keyof TTarget['columns'] & string = keyof TTarget['columns'] & string
  >(relationName: K, cols: C[]): SelectQueryBuilder<T, TTable> {
    return this.selectRelationColumns(relationName, ...cols);
  }


  /**
   * Selects columns for the root table and relations from a single config object.
   */
  selectColumnsDeep(config: DeepSelectConfig<TTable>): SelectQueryBuilder<T, TTable> {
    let qb: SelectQueryBuilder<T, TTable> = this;

    if (config.root?.length) {
      qb = qb.selectColumns(...config.root);
    }

    for (const key of Object.keys(config) as (keyof typeof config)[]) {
      if (key === 'root') continue;
      const relName = key as keyof TTable['relations'] & string;
      const cols = config[relName as keyof DeepSelectConfig<TTable>] as string[] | undefined;
      if (!cols || !cols.length) continue;
      qb = qb.selectRelationColumns(relName, ...(cols as string[]));
    }

    return qb;
  }



  getLazyRelations(): (keyof RelationMap<TTable>)[] {

    return Array.from(this.lazyRelations) as (keyof RelationMap<TTable>)[];

  }



  getTable(): TTable {

    return this.env.table as TTable;

  }



  async execute(ctx: OrmSession): Promise<Entity<TTable>[]> {

    return executeHydrated(ctx, this);

  }



  async executeWithContexts(execCtx: ExecutionContext, hydCtx: HydrationContext): Promise<Entity<TTable>[]> {

    return executeHydratedWithContexts(execCtx, hydCtx, this);

  }



  /**

   * Adds a WHERE condition to the query

   * @param expr - Expression for the WHERE clause

   * @returns New query builder instance with the WHERE condition

   */

  where(expr: ExpressionNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withWhere(expr));

    return this.clone(nextContext);

  }



  /**

   * Adds a GROUP BY clause to the query

   * @param col - Column definition or column node to group by

   * @returns New query builder instance with the GROUP BY clause

   */

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withGroupBy(col));

    return this.clone(nextContext);

  }



  /**

   * Adds a HAVING condition to the query

   * @param expr - Expression for the HAVING clause

   * @returns New query builder instance with the HAVING condition

   */

  having(expr: ExpressionNode): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withHaving(expr));

    return this.clone(nextContext);

  }



  /**

   * Adds an ORDER BY clause to the query

   * @param col - Column definition or column node to order by

   * @param direction - Order direction (defaults to ASC)

   * @returns New query builder instance with the ORDER BY clause

   */

  orderBy(col: ColumnDef | ColumnNode, direction: OrderDirection = ORDER_DIRECTIONS.ASC): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withOrderBy(col, direction));

    return this.clone(nextContext);

  }



  /**

   * Adds a DISTINCT clause to the query

   * @param cols - Columns to make distinct

   * @returns New query builder instance with the DISTINCT clause

   */

  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T, TTable> {

    return this.clone(this.columnSelector.distinct(this.context, cols));

  }



  /**

   * Adds a LIMIT clause to the query

   * @param n - Maximum number of rows to return

   * @returns New query builder instance with the LIMIT clause

   */

  limit(n: number): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withLimit(n));

    return this.clone(nextContext);

  }



  /**

   * Adds an OFFSET clause to the query

   * @param n - Number of rows to skip

   * @returns New query builder instance with the OFFSET clause

   */

  offset(n: number): SelectQueryBuilder<T, TTable> {

    const nextContext = this.applyAst(this.context, service => service.withOffset(n));

    return this.clone(nextContext);

  }



  /**

   * Combines this query with another using UNION

   * @param query - Query to union with

   * @returns New query builder instance with the set operation

   */

  union(query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    return this.clone(this.applySetOperation('UNION', query));

  }



  /**

   * Combines this query with another using UNION ALL

   * @param query - Query to union with

   * @returns New query builder instance with the set operation

   */

  unionAll(query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    return this.clone(this.applySetOperation('UNION ALL', query));

  }



  /**

   * Combines this query with another using INTERSECT

   * @param query - Query to intersect with

   * @returns New query builder instance with the set operation

   */

  intersect(query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    return this.clone(this.applySetOperation('INTERSECT', query));

  }



  /**

   * Combines this query with another using EXCEPT

   * @param query - Query to subtract

   * @returns New query builder instance with the set operation

   */

  except(query: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    return this.clone(this.applySetOperation('EXCEPT', query));

  }



  /**

   * Adds a WHERE EXISTS condition to the query

   * @param subquery - Subquery to check for existence

   * @returns New query builder instance with the WHERE EXISTS condition

   */

  whereExists(subquery: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

    const subAst = this.resolveQueryNode(subquery);

    return this.where(exists(subAst));

  }



  /**

   * Adds a WHERE NOT EXISTS condition to the query

   * @param subquery - Subquery to check for non-existence

   * @returns New query builder instance with the WHERE NOT EXISTS condition

   */

  whereNotExists(subquery: SelectQueryBuilder<any, TableDef<any>> | SelectQueryNode): SelectQueryBuilder<T, TTable> {

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

    callback?: <TChildTable extends TableDef>(

      qb: SelectQueryBuilder<any, TChildTable>

    ) => SelectQueryBuilder<any, TChildTable>

  ): SelectQueryBuilder<T, TTable> {

    const relation = this.env.table.relations[relationName];

    if (!relation) {

      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);

    }



    let subQb = this.createChildBuilder<any, typeof relation.target>(relation.target);

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

    callback?: <TChildTable extends TableDef>(

      qb: SelectQueryBuilder<any, TChildTable>

    ) => SelectQueryBuilder<any, TChildTable>

  ): SelectQueryBuilder<T, TTable> {

    const relation = this.env.table.relations[relationName];

    if (!relation) {

      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);

    }



    let subQb = this.createChildBuilder<any, typeof relation.target>(relation.target);

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

  compile(dialect: SelectDialectInput): CompiledQuery {

    const resolved = resolveDialectInput(dialect);

    return resolved.compileSelect(this.context.state.ast);

  }



  /**

   * Converts the query to SQL string for a specific dialect

   * @param dialect - Database dialect to generate SQL for

   * @returns SQL string representation of the query

   */

  toSql(dialect: SelectDialectInput): string {

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

