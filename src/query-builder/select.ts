import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import { OrderingTerm, SelectQueryNode, SetOperationKind } from '../core/ast/query.js';
import { HydrationPlan } from '../core/hydration/types.js';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  BinaryExpressionNode,
  CaseExpressionNode,
  WindowFunctionNode,
  and,
  exists,
  notExists,
  OperandNode
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
import { ColumnSelector } from './column-selector.js';
import { RelationIncludeOptions, RelationTargetColumns, TypedRelationIncludeOptions } from './relation-types.js';
import { RelationKinds } from '../schema/relation.js';
import { JOIN_KINDS, JoinKind, ORDER_DIRECTIONS, OrderDirection } from '../core/sql/sql.js';
import { EntityInstance, RelationMap } from '../schema/types.js';
import { OrmSession } from '../orm/orm-session.ts';
import { ExecutionContext } from '../orm/execution-context.js';
import { HydrationContext } from '../orm/hydration-context.js';
import { executeHydrated, executeHydratedWithContexts } from '../orm/execute.js';
import { resolveSelectQuery } from './query-resolution.js';
import {
  applyOrderBy,
  buildWhereHasPredicate,
  executeCount,
  executePagedQuery,
  RelationCallback,
  WhereHasOptions
} from './select/select-operations.js';
import { SelectFromFacet } from './select/from-facet.js';
import { SelectJoinFacet } from './select/join-facet.js';
import { SelectProjectionFacet } from './select/projection-facet.js';
import { SelectPredicateFacet } from './select/predicate-facet.js';
import { SelectCTEFacet } from './select/cte-facet.js';
import { SelectSetOpFacet } from './select/setop-facet.js';
import { SelectRelationFacet } from './select/relation-facet.js';


type ColumnSelectionValue = ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode;

type DeepSelectEntry<TTable extends TableDef> = {
  type: 'root';
  columns: (keyof TTable['columns'] & string)[];
} | {
  type: 'relation';
  relationName: keyof TTable['relations'] & string;
  columns: string[];
};

type DeepSelectConfig<TTable extends TableDef> = DeepSelectEntry<TTable>[];


/**
 * Main query builder class for constructing SQL SELECT queries
 * @typeParam T - Result type for projections (unused)
 * @typeParam TTable - Table definition being queried
 */
export class SelectQueryBuilder<T = unknown, TTable extends TableDef = TableDef> {
  private readonly env: SelectQueryBuilderEnvironment;
  private readonly context: SelectQueryBuilderContext;
  private readonly columnSelector: ColumnSelector;
  private readonly fromFacet: SelectFromFacet;
  private readonly joinFacet: SelectJoinFacet;
  private readonly projectionFacet: SelectProjectionFacet;
  private readonly predicateFacet: SelectPredicateFacet;
  private readonly cteFacet: SelectCTEFacet;
  private readonly setOpFacet: SelectSetOpFacet;
  private readonly relationFacet: SelectRelationFacet;
  private readonly lazyRelations: Set<string>;
  private readonly lazyRelationOptions: Map<string, RelationIncludeOptions>;

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
    lazyRelations?: Set<string>,
    lazyRelationOptions?: Map<string, RelationIncludeOptions>
  ) {
    const deps = resolveSelectQueryBuilderDependencies(dependencies);
    this.env = { table, deps };
    const createAstService = (nextState: SelectQueryState) => deps.createQueryAstService(table, nextState);
    const initialState = state ?? deps.createState(table);
    const initialHydration = hydration ?? deps.createHydration(table);
    this.context = {
      state: initialState,
      hydration: initialHydration
    };
    this.lazyRelations = new Set(lazyRelations ?? []);
    this.lazyRelationOptions = new Map(lazyRelationOptions ?? []);
    this.columnSelector = deps.createColumnSelector(this.env);
    const relationManager = deps.createRelationManager(this.env);
    this.fromFacet = new SelectFromFacet(this.env, createAstService);
    this.joinFacet = new SelectJoinFacet(this.env, createAstService);
    this.projectionFacet = new SelectProjectionFacet(this.columnSelector);
    this.predicateFacet = new SelectPredicateFacet(this.env, createAstService);
    this.cteFacet = new SelectCTEFacet(this.env, createAstService);
    this.setOpFacet = new SelectSetOpFacet(this.env, createAstService);
    this.relationFacet = new SelectRelationFacet(relationManager);
  }

  /**
   * Creates a new SelectQueryBuilder instance with updated context and lazy relations
   * @param context - Updated query context
   * @param lazyRelations - Updated lazy relations set
   * @returns New SelectQueryBuilder instance
   */
  private clone(
    context: SelectQueryBuilderContext = this.context,
    lazyRelations = new Set(this.lazyRelations),
    lazyRelationOptions = new Map(this.lazyRelationOptions)
  ): SelectQueryBuilder<T, TTable> {
    return new SelectQueryBuilder(
      this.env.table as TTable,
      context.state,
      context.hydration,
      this.env.deps,
      lazyRelations,
      lazyRelationOptions
    );
  }

  /**
   * Applies an alias to the root FROM table.
   * @param alias - Alias to apply
   */
  as(alias: string): SelectQueryBuilder<T, TTable> {
    const nextContext = this.fromFacet.as(this.context, alias);
    return this.clone(nextContext);
  }



  /**
   * Applies correlation expression to the query AST
   * @param ast - Query AST to modify
   * @param correlation - Correlation expression
   * @returns Modified AST with correlation applied
   */
  private applyCorrelation(ast: SelectQueryNode, correlation?: ExpressionNode): SelectQueryNode {
    if (!correlation) return ast;
    const combinedWhere = ast.where ? and(correlation, ast.where) : correlation;
    return {
      ...ast,
      where: combinedWhere
    };
  }

  /**
   * Creates a new child query builder for a related table
   * @param table - Table definition for the child builder
   * @returns New SelectQueryBuilder instance for the child table
   */
  private createChildBuilder<R, TChild extends TableDef>(table: TChild): SelectQueryBuilder<R, TChild> {
    return new SelectQueryBuilder(table, undefined, undefined, this.env.deps);
  }

  /**
   * Applies a set operation to the query
   * @param operator - Set operation kind
   * @param query - Query to combine with
   * @returns Updated query context with set operation
   */
  private applySetOperation<TSub extends TableDef>(
    operator: SetOperationKind,
    query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode
  ): SelectQueryBuilderContext {
    const subAst = resolveSelectQuery(query);
    return this.setOpFacet.applySetOperation(this.context, operator, subAst);
  }


  /**
   * Selects columns for the query (unified overloaded method).
   * Can be called with column names or a projection object.
   * @param args - Column names or projection object
   * @returns New query builder instance with selected columns
   */
  select<K extends keyof TTable['columns'] & string>(
    ...args: K[]
  ): SelectQueryBuilder<T, TTable>;
  select(columns: Record<string, ColumnSelectionValue>): SelectQueryBuilder<T, TTable>;
  select<K extends keyof TTable['columns'] & string>(
    ...args: K[] | [Record<string, ColumnSelectionValue>]
  ): SelectQueryBuilder<T, TTable> {
    // If first arg is an object (not a string), treat as projection map
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null && typeof args[0] !== 'string') {
      const columns = args[0] as Record<string, ColumnSelectionValue>;
      return this.clone(this.projectionFacet.select(this.context, columns));
    }

    // Otherwise, treat as column names
    const cols = args as K[];
    const selection: Record<string, ColumnDef> = {};
    for (const key of cols) {
      const col = this.env.table.columns[key];
      if (!col) {
        throw new Error(`Column '${key}' not found on table '${this.env.table.name}'`);
      }
      selection[key] = col;
    }

    return this.clone(this.projectionFacet.select(this.context, selection));
  }

  /**
   * Selects raw column expressions
   * @param cols - Column expressions as strings
   * @returns New query builder instance with raw column selections
   */
  selectRaw(...cols: string[]): SelectQueryBuilder<T, TTable> {
    return this.clone(this.projectionFacet.selectRaw(this.context, cols));
  }

  /**
   * Adds a Common Table Expression (CTE) to the query
   * @param name - Name of the CTE
   * @param query - Query builder or query node for the CTE
   * @param columns - Optional column names for the CTE
   * @returns New query builder instance with the CTE
   */
  with<TSub extends TableDef>(name: string, query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(query);
    const nextContext = this.cteFacet.withCTE(this.context, name, subAst, columns, false);
    return this.clone(nextContext);
  }

  /**
   * Adds a recursive Common Table Expression (CTE) to the query
   * @param name - Name of the CTE
   * @param query - Query builder or query node for the CTE
   * @param columns - Optional column names for the CTE
   * @returns New query builder instance with the recursive CTE
   */
  withRecursive<TSub extends TableDef>(name: string, query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(query);
    const nextContext = this.cteFacet.withCTE(this.context, name, subAst, columns, true);
    return this.clone(nextContext);
  }

  /**
   * Replaces the FROM clause with a derived table (subquery with alias)
   * @param subquery - Subquery to use as the FROM source
   * @param alias - Alias for the derived table
   * @param columnAliases - Optional column alias list
   * @returns New query builder instance with updated FROM
   */
  fromSubquery<TSub extends TableDef>(
    subquery: SelectQueryBuilder<unknown, TSub> | SelectQueryNode,
    alias: string,
    columnAliases?: string[]
  ): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(subquery);
    const nextContext = this.fromFacet.fromSubquery(this.context, subAst, alias, columnAliases);
    return this.clone(nextContext);
  }

  /**
   * Replaces the FROM clause with a function table expression.
   * @param name - Function name
   * @param args - Optional function arguments
   * @param alias - Optional alias for the function table
   * @param options - Optional function-table metadata (lateral, ordinality, column aliases, schema)
   */
  fromFunctionTable(
    name: string,
    args: OperandNode[] = [],
    alias?: string,
    options?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = this.fromFacet.fromFunctionTable(this.context, name, args, alias, options);
    return this.clone(nextContext);
  }

  /**
   * Selects a subquery as a column
   * @param alias - Alias for the subquery column
   * @param sub - Query builder or query node for the subquery
   * @returns New query builder instance with the subquery selection
   */
  selectSubquery<TSub extends TableDef>(alias: string, sub: SelectQueryBuilder<unknown, TSub> | SelectQueryNode): SelectQueryBuilder<T, TTable> {
    const query = resolveSelectQuery(sub);
    return this.clone(this.projectionFacet.selectSubquery(this.context, alias, query));
  }

  /**
   * Adds a JOIN against a derived table (subquery with alias)
   * @param subquery - Subquery to join
   * @param alias - Alias for the derived table
   * @param condition - Join condition expression
   * @param joinKind - Join kind (defaults to INNER)
   * @param columnAliases - Optional column alias list for the derived table
   * @returns New query builder instance with the derived-table join
   */
  joinSubquery<TSub extends TableDef>(
    subquery: SelectQueryBuilder<unknown, TSub> | SelectQueryNode,
    alias: string,
    condition: BinaryExpressionNode,
    joinKind: JoinKind = JOIN_KINDS.INNER,
    columnAliases?: string[]
  ): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(subquery);
    const nextContext = this.joinFacet.joinSubquery(this.context, subAst, alias, condition, joinKind, columnAliases);
    return this.clone(nextContext);
  }

  /**
   * Adds a join against a function table (e.g., `generate_series`) using `fnTable` internally.
   * @param name - Function name
   * @param args - Optional arguments passed to the function
   * @param alias - Alias for the function table so columns can be referenced
   * @param condition - Join condition expression
   * @param joinKind - Kind of join (defaults to INNER)
   * @param options - Optional metadata (lateral, ordinality, column aliases, schema)
   */
  joinFunctionTable(
    name: string,
    args: OperandNode[] = [],
    alias: string,
    condition: BinaryExpressionNode,
    joinKind: JoinKind = JOIN_KINDS.INNER,
    options?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = this.joinFacet.joinFunctionTable(this.context, name, args, alias, condition, joinKind, options);
    return this.clone(nextContext);
  }

  /**
   * Adds an INNER JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the INNER JOIN
   */
  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {
    const nextContext = this.joinFacet.applyJoin(this.context, table, condition, JOIN_KINDS.INNER);
    return this.clone(nextContext);
  }

  /**
   * Adds a LEFT JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the LEFT JOIN
   */
  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {
    const nextContext = this.joinFacet.applyJoin(this.context, table, condition, JOIN_KINDS.LEFT);
    return this.clone(nextContext);
  }

  /**
   * Adds a RIGHT JOIN to the query
   * @param table - Table to join
   * @param condition - Join condition expression
   * @returns New query builder instance with the RIGHT JOIN
   */
  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T, TTable> {
    const nextContext = this.joinFacet.applyJoin(this.context, table, condition, JOIN_KINDS.RIGHT);
    return this.clone(nextContext);
  }

  /**
   * Matches records based on a relationship
   * @param relationName - Name of the relationship to match
   * @param predicate - Optional predicate expression
   * @returns New query builder instance with the relationship match
   */
  match<K extends keyof TTable['relations'] & string>(
    relationName: K,
    predicate?: ExpressionNode
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = this.relationFacet.match(this.context, relationName, predicate);
    return this.clone(nextContext);
  }

  /**
   * Joins a related table
   * @param relationName - Name of the relationship to join
   * @param joinKind - Type of join (defaults to INNER)
   * @param extraCondition - Optional additional join condition
   * @returns New query builder instance with the relationship join
   */
  joinRelation<K extends keyof TTable['relations'] & string>(
    relationName: K,
    joinKind: JoinKind = JOIN_KINDS.INNER,
    extraCondition?: ExpressionNode
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = this.relationFacet.joinRelation(this.context, relationName, joinKind, extraCondition);
    return this.clone(nextContext);
  }

  /**
   * Includes related data in the query results
   * @param relationName - Name of the relationship to include
   * @param options - Optional include options
   * @returns New query builder instance with the relationship inclusion
   */
  include<K extends keyof TTable['relations'] & string>(
    relationName: K,
    options?: TypedRelationIncludeOptions<TTable['relations'][K]>
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = this.relationFacet.include(this.context, relationName, options);
    return this.clone(nextContext);
  }

  /**
   * Includes a relation lazily in the query results
   * @param relationName - Name of the relation to include lazily
   * @param options - Optional include options for lazy loading
   * @returns New query builder instance with lazy relation inclusion
   */
  includeLazy<K extends keyof RelationMap<TTable>>(
    relationName: K,
    options?: TypedRelationIncludeOptions<TTable['relations'][K]>
  ): SelectQueryBuilder<T, TTable> {
    let nextContext = this.context;
    const relation = this.env.table.relations[relationName as string];
    if (relation?.type === RelationKinds.BelongsTo) {
      const foreignKey = relation.foreignKey;
      const fkColumn = this.env.table.columns[foreignKey];
      if (fkColumn) {
        const hasAlias = nextContext.state.ast.columns.some(col => {
          const node = col as { alias?: string; name?: string };
          return (node.alias ?? node.name) === foreignKey;
        });
        if (!hasAlias) {
          nextContext = this.columnSelector.select(nextContext, { [foreignKey]: fkColumn });
        }
      }
    }
    const nextLazy = new Set(this.lazyRelations);
    nextLazy.add(relationName as string);
    const nextOptions = new Map(this.lazyRelationOptions);
    if (options) {
      nextOptions.set(relationName as string, options);
    } else {
      nextOptions.delete(relationName as string);
    }
    return this.clone(nextContext, nextLazy, nextOptions);
  }

  /**
   * Convenience alias for including only specific columns from a relation.
   */
  includePick<
    K extends keyof TTable['relations'] & string,
    C extends RelationTargetColumns<TTable['relations'][K]>
  >(relationName: K, cols: C[]): SelectQueryBuilder<T, TTable> {
    const options = { columns: cols as readonly C[] } as unknown as TypedRelationIncludeOptions<TTable['relations'][K]>;
    return this.include(relationName, options);
  }


  /**
   * Selects columns for the root table and relations from an array of entries
   * @param config - Configuration array for deep column selection
   * @returns New query builder instance with deep column selections
   */
  selectColumnsDeep(config: DeepSelectConfig<TTable>): SelectQueryBuilder<T, TTable> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let currBuilder: SelectQueryBuilder<T, TTable> = this;

    for (const entry of config) {
      if (entry.type === 'root') {
        currBuilder = currBuilder.select(...entry.columns);
      } else {
        const options = { columns: entry.columns } as unknown as TypedRelationIncludeOptions<TTable['relations'][typeof entry.relationName]>;
        currBuilder = currBuilder.include(entry.relationName, options);
      }
    }

    return currBuilder;
  }

  /**
   * Gets the list of lazy relations
   * @returns Array of lazy relation names
   */
  getLazyRelations(): (keyof RelationMap<TTable>)[] {
    return Array.from(this.lazyRelations) as (keyof RelationMap<TTable>)[];
  }

  /**
   * Gets lazy relation include options
   * @returns Map of relation names to include options
   */
  getLazyRelationOptions(): Map<string, RelationIncludeOptions> {
    return new Map(this.lazyRelationOptions);
  }

  /**
   * Gets the table definition for this query builder
   * @returns Table definition
   */
  getTable(): TTable {
    return this.env.table as TTable;
  }

  /**
   * Executes the query and returns hydrated results
   * @param ctx - ORM session context
   * @returns Promise of entity instances
   */
  async execute(ctx: OrmSession): Promise<EntityInstance<TTable>[]> {
    return executeHydrated(ctx, this);
  }

  /**
   * Executes a count query for the current builder without LIMIT/OFFSET clauses.
   *
   * @example
   * const total = await qb.count(session);
   */
  async count(session: OrmSession): Promise<number> {
    return executeCount(this.context, this.env, session);
  }

  /**
   * Executes the query and returns both the paged items and the total.
   *
   * @example
   * const { items, totalItems } = await qb.executePaged(session, { page: 1, pageSize: 20 });
   */
  async executePaged(
    session: OrmSession,
    options: { page: number; pageSize: number }
  ): Promise<{ items: EntityInstance<TTable>[]; totalItems: number }> {
    return executePagedQuery(this, session, options, sess => this.count(sess));
  }

  /**
   * Executes the query with provided execution and hydration contexts
   * @param execCtx - Execution context
   * @param hydCtx - Hydration context
   * @returns Promise of entity instances
   */
  async executeWithContexts(execCtx: ExecutionContext, hydCtx: HydrationContext): Promise<EntityInstance<TTable>[]> {
    return executeHydratedWithContexts(execCtx, hydCtx, this);
  }

  /**
   * Adds a WHERE condition to the query
   * @param expr - Expression for the WHERE clause
   * @returns New query builder instance with the WHERE condition
   */
  where(expr: ExpressionNode): SelectQueryBuilder<T, TTable> {
    const nextContext = this.predicateFacet.where(this.context, expr);
    return this.clone(nextContext);
  }

  /**
   * Adds a GROUP BY clause to the query
   * @param term - Column definition or ordering term to group by
   * @returns New query builder instance with the GROUP BY clause
   */
  groupBy(term: ColumnDef | OrderingTerm): SelectQueryBuilder<T, TTable> {
    const nextContext = this.predicateFacet.groupBy(this.context, term);
    return this.clone(nextContext);
  }

  /**
   * Adds a HAVING condition to the query
   * @param expr - Expression for the HAVING clause
   * @returns New query builder instance with the HAVING condition
   */
  having(expr: ExpressionNode): SelectQueryBuilder<T, TTable> {
    const nextContext = this.predicateFacet.having(this.context, expr);
    return this.clone(nextContext);
  }



  /**
   * Adds an ORDER BY clause to the query
   * @param term - Column definition or ordering term to order by
   * @param directionOrOptions - Order direction or options (defaults to ASC)
   * @returns New query builder instance with the ORDER BY clause
   *
   * @example
   * qb.orderBy(userTable.columns.createdAt, 'DESC');
   */
  orderBy(
    term: ColumnDef | OrderingTerm,
    directionOrOptions: OrderDirection | { direction?: OrderDirection; nulls?: 'FIRST' | 'LAST'; collation?: string } = ORDER_DIRECTIONS.ASC
  ): SelectQueryBuilder<T, TTable> {
    const nextContext = applyOrderBy(this.context, this.predicateFacet, term, directionOrOptions);

    return this.clone(nextContext);
  }

  /**
   * Adds a DISTINCT clause to the query
   * @param cols - Columns to make distinct
   * @returns New query builder instance with the DISTINCT clause
   */
  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T, TTable> {
    return this.clone(this.projectionFacet.distinct(this.context, cols));
  }

  /**
   * Adds a LIMIT clause to the query
   * @param n - Maximum number of rows to return
   * @returns New query builder instance with the LIMIT clause
   */
  limit(n: number): SelectQueryBuilder<T, TTable> {
    const nextContext = this.predicateFacet.limit(this.context, n);
    return this.clone(nextContext);
  }

  /**
   * Adds an OFFSET clause to the query
   * @param n - Number of rows to skip
   * @returns New query builder instance with the OFFSET clause
   */
  offset(n: number): SelectQueryBuilder<T, TTable> {
    const nextContext = this.predicateFacet.offset(this.context, n);
    return this.clone(nextContext);
  }

  /**
   * Combines this query with another using UNION
   * @param query - Query to union with
   * @returns New query builder instance with the set operation
   */
  union<TSub extends TableDef>(query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode): SelectQueryBuilder<T, TTable> {
    return this.clone(this.applySetOperation('UNION', query));
  }

  /**
   * Combines this query with another using UNION ALL
   * @param query - Query to union with
   * @returns New query builder instance with the set operation
   */
  unionAll<TSub extends TableDef>(query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode): SelectQueryBuilder<T, TTable> {
    return this.clone(this.applySetOperation('UNION ALL', query));
  }

  /**
   * Combines this query with another using INTERSECT
   * @param query - Query to intersect with
   * @returns New query builder instance with the set operation
   */
  intersect<TSub extends TableDef>(query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode): SelectQueryBuilder<T, TTable> {
    return this.clone(this.applySetOperation('INTERSECT', query));
  }

  /**
   * Combines this query with another using EXCEPT
   * @param query - Query to subtract
   * @returns New query builder instance with the set operation
   */
  except<TSub extends TableDef>(query: SelectQueryBuilder<unknown, TSub> | SelectQueryNode): SelectQueryBuilder<T, TTable> {
    return this.clone(this.applySetOperation('EXCEPT', query));
  }

  /**
   * Adds a WHERE EXISTS condition to the query
   * @param subquery - Subquery to check for existence
   * @returns New query builder instance with the WHERE EXISTS condition
   */
  whereExists<TSub extends TableDef>(
    subquery: SelectQueryBuilder<unknown, TSub> | SelectQueryNode,
    correlate?: ExpressionNode
  ): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(subquery);
    const correlated = this.applyCorrelation(subAst, correlate);
    return this.where(exists(correlated));
  }

  /**
   * Adds a WHERE NOT EXISTS condition to the query
   * @param subquery - Subquery to check for non-existence
   * @returns New query builder instance with the WHERE NOT EXISTS condition
   */
  whereNotExists<TSub extends TableDef>(
    subquery: SelectQueryBuilder<unknown, TSub> | SelectQueryNode,
    correlate?: ExpressionNode
  ): SelectQueryBuilder<T, TTable> {
    const subAst = resolveSelectQuery(subquery);
    const correlated = this.applyCorrelation(subAst, correlate);
    return this.where(notExists(correlated));
  }

  /**
   * Adds a WHERE EXISTS condition based on a relationship
   * @param relationName - Name of the relationship to check
   * @param callback - Optional callback to modify the relationship query
   * @returns New query builder instance with the relationship existence check
   *
   * @example
   * qb.whereHas('posts', postQb => postQb.where(eq(postTable.columns.published, true)));
   */
  whereHas<K extends keyof TTable['relations'] & string>(
    relationName: K,
    callbackOrOptions?: RelationCallback | WhereHasOptions,
    maybeOptions?: WhereHasOptions
  ): SelectQueryBuilder<T, TTable> {
    const predicate = buildWhereHasPredicate(
      this.env,
      this.context,
      this.relationFacet,
      table => this.createChildBuilder(table),
      relationName,
      callbackOrOptions,
      maybeOptions,
      false
    );

    return this.where(predicate);
  }

  /**
   * Adds a WHERE NOT EXISTS condition based on a relationship
   * @param relationName - Name of the relationship to check
   * @param callback - Optional callback to modify the relationship query
   * @returns New query builder instance with the relationship non-existence check
   *
   * @example
   * qb.whereHasNot('posts', postQb => postQb.where(eq(postTable.columns.published, true)));
   */
  whereHasNot<K extends keyof TTable['relations'] & string>(
    relationName: K,
    callbackOrOptions?: RelationCallback | WhereHasOptions,
    maybeOptions?: WhereHasOptions
  ): SelectQueryBuilder<T, TTable> {
    const predicate = buildWhereHasPredicate(
      this.env,
      this.context,
      this.relationFacet,
      table => this.createChildBuilder(table),
      relationName,
      callbackOrOptions,
      maybeOptions,
      true
    );

    return this.where(predicate);
  }



  /**
   * Compiles the query to SQL for a specific dialect
   * @param dialect - Database dialect to compile for
   * @returns Compiled query with SQL and parameters
   */
  compile(dialect: SelectDialectInput): CompiledQuery {
    const resolved = resolveDialectInput(dialect);
    return resolved.compileSelect(this.getAST());
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

