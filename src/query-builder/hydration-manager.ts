import { TableDef } from '../schema/table.js';
import { RelationDef, RelationKinds } from '../schema/relation.js';
import { CommonTableExpressionNode, OrderByNode, SelectQueryNode } from '../core/ast/query.js';
import { HydrationPlan } from '../core/hydration/types.js';
import { HydrationPlanner } from './hydration-planner.js';
import { ProjectionNode, SelectQueryState } from './select-query-state.js';
import { ColumnNode, eq } from '../core/ast/expression.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { JOIN_KINDS } from '../core/sql/sql.js';

/**
 * Manages hydration planning for query results
 */
export class HydrationManager {
  /**
   * Creates a new HydrationManager instance
   * @param table - Table definition
   * @param planner - Hydration planner
   */
  constructor(
    private readonly table: TableDef,
    private readonly planner: HydrationPlanner
  ) { }

  /**
   * Creates a new HydrationManager with updated planner
   * @param nextPlanner - Updated hydration planner
   * @returns New HydrationManager instance
   */
  private clone(nextPlanner: HydrationPlanner): HydrationManager {
    return new HydrationManager(this.table, nextPlanner);
  }

  /**
   * Handles column selection for hydration planning
   * @param state - Current query state
   * @param newColumns - Newly selected columns
   * @returns Updated HydrationManager with captured columns
   */
  onColumnsSelected(state: SelectQueryState, newColumns: ProjectionNode[]): HydrationManager {
    const updated = this.planner.captureRootColumns(newColumns);
    return this.clone(updated);
  }

  /**
   * Handles relation inclusion for hydration planning
   * @param state - Current query state
   * @param relation - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for the relation
   * @param targetColumns - Target columns to include
   * @returns Updated HydrationManager with included relation
   */
  onRelationIncluded(
    state: SelectQueryState,
    relation: RelationDef,
    relationName: string,
    aliasPrefix: string,
    targetColumns: string[],
    pivot?: { aliasPrefix: string; columns: string[]; merge?: boolean }
  ): HydrationManager {
    const withRoots = this.planner.captureRootColumns(state.ast.columns);
    const next = withRoots.includeRelation(relation, relationName, aliasPrefix, targetColumns, pivot);
    return this.clone(next);
  }

  /**
   * Applies hydration plan to the AST
   * @param ast - Query AST to modify
   * @returns AST with hydration metadata
   */
  applyToAst(ast: SelectQueryNode): SelectQueryNode {
    // Hydration is not applied to compound set queries since row identity is ambiguous.
    if (ast.setOps && ast.setOps.length > 0) {
      return ast;
    }

    const plan = this.planner.getPlan();
    if (!plan) return ast;

    const needsPaginationGuard = this.requiresParentPagination(ast, plan);
    const rewritten = needsPaginationGuard ? this.wrapForParentPagination(ast, plan) : ast;
    return this.attachHydrationMeta(rewritten, plan);
  }

  /**
   * Gets the current hydration plan
   * @returns Hydration plan or undefined if none exists
   */
  getPlan(): HydrationPlan | undefined {
    return this.planner.getPlan();
  }

  /**
   * Attaches hydration metadata to a query AST node.
   */
  private attachHydrationMeta(ast: SelectQueryNode, plan: HydrationPlan): SelectQueryNode {
    return {
      ...ast,
      meta: {
        ...(ast.meta || {}),
        hydration: plan
      }
    };
  }

  /**
   * Determines whether the query needs pagination rewriting to keep LIMIT/OFFSET
   * applied to parent rows when eager-loading multiplicative relations.
   */
  private requiresParentPagination(ast: SelectQueryNode, plan: HydrationPlan): boolean {
    const hasPagination = ast.limit !== undefined || ast.offset !== undefined;
    return hasPagination && this.hasMultiplyingRelations(plan);
  }

  /**
   * Checks if the hydration plan contains relations that multiply rows
   * @param plan - Hydration plan to check
   * @returns True if plan has HasMany or BelongsToMany relations
   */
  private hasMultiplyingRelations(plan: HydrationPlan): boolean {
    return plan.relations.some(
      rel => rel.type === RelationKinds.HasMany || rel.type === RelationKinds.BelongsToMany
    );
  }

  /**
   * Rewrites the query using CTEs so LIMIT/OFFSET target distinct parent rows
   * instead of the joined result set.
   *
   * The strategy:
   * - Hoist the original query (minus limit/offset) into a base CTE.
   * - Select distinct parent ids from that base CTE with the original ordering and pagination.
   * - Join the base CTE against the paged ids to retrieve the joined rows for just that page.
   */
  private wrapForParentPagination(ast: SelectQueryNode, plan: HydrationPlan): SelectQueryNode {
    const projectionNames = this.getProjectionNames(ast.columns);
    if (!projectionNames) {
      return ast;
    }

    const projectionAliases = this.buildProjectionAliasMap(ast.columns);
    const projectionSet = new Set(projectionNames);
    const rootPkAlias = projectionAliases.get(`${plan.rootTable}.${plan.rootPrimaryKey}`) ?? plan.rootPrimaryKey;

    const baseCteName = this.nextCteName(ast.ctes, '__metal_pagination_base');
    const baseQuery: SelectQueryNode = {
      ...ast,
      ctes: undefined,
      limit: undefined,
      offset: undefined,
      orderBy: undefined,
      meta: undefined
    };

    const baseCte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name: baseCteName,
      query: baseQuery,
      recursive: false
    };

    const orderBy = this.mapOrderBy(ast.orderBy, plan, projectionAliases, baseCteName, projectionSet);
    // When an order-by uses child-table columns we cannot safely rewrite pagination,
    // so preserve the original query to avoid changing semantics.
    if (orderBy === null) {
      return ast;
    }

    const pageCteName = this.nextCteName([...(ast.ctes ?? []), baseCte], '__metal_pagination_page');
    const pagingColumns = this.buildPagingColumns(rootPkAlias, orderBy, baseCteName);

    const pageCte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name: pageCteName,
      query: {
        type: 'SelectQuery',
        from: { type: 'Table', name: baseCteName },
        columns: pagingColumns,
        joins: [],
        distinct: [{ type: 'Column', table: baseCteName, name: rootPkAlias }],
        orderBy,
        limit: ast.limit,
        offset: ast.offset
      },
      recursive: false
    };

    const joinCondition = eq(
      { type: 'Column', table: baseCteName, name: rootPkAlias },
      { type: 'Column', table: pageCteName, name: rootPkAlias }
    );

    const outerColumns: ColumnNode[] = projectionNames.map(name => ({
      type: 'Column',
      table: baseCteName,
      name,
      alias: name
    }));

    return {
      type: 'SelectQuery',
      from: { type: 'Table', name: baseCteName },
      columns: outerColumns,
      joins: [createJoinNode(JOIN_KINDS.INNER, pageCteName, joinCondition)],
      orderBy,
      ctes: [...(ast.ctes ?? []), baseCte, pageCte]
    };
  }

  /**
   * Generates a unique CTE name by appending a suffix if needed
   * @param existing - Existing CTE nodes
   * @param baseName - Base name for the CTE
   * @returns Unique CTE name
   */
  private nextCteName(existing: CommonTableExpressionNode[] | undefined, baseName: string): string {
    const names = new Set((existing ?? []).map(cte => cte.name));
    let candidate = baseName;
    let suffix = 1;

    while (names.has(candidate)) {
      suffix += 1;
      candidate = `${baseName}_${suffix}`;
    }

    return candidate;
  }

  /**
   * Extracts projection names from column nodes
   * @param columns - Projection nodes
   * @returns Array of names or undefined if any column lacks name/alias
   */
  private getProjectionNames(columns: ProjectionNode[]): string[] | undefined {
    const names: string[] = [];
    for (const col of columns) {
      const node = col as { alias?: string; name?: string };
      const alias = node.alias ?? node.name;
      if (!alias) return undefined;
      names.push(alias);
    }
    return names;
  }

  /**
   * Builds a map of column keys to their aliases from projection nodes
   * @param columns - Projection nodes
   * @returns Map of 'table.name' to alias
   */
  private buildProjectionAliasMap(columns: ProjectionNode[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const col of columns) {
      if ((col as ColumnNode).type !== 'Column') continue;
      const node = col as ColumnNode;
      const key = `${node.table}.${node.name}`;
      map.set(key, node.alias ?? node.name);
    }
    return map;
  }

  /**
   * Maps order by nodes to use base CTE alias
   * @param orderBy - Original order by nodes
   * @param plan - Hydration plan
   * @param projectionAliases - Map of column aliases
   * @param baseAlias - Base CTE alias
   * @param availableColumns - Set of available column names
   * @returns Mapped order by nodes, null if cannot map
   */
  private mapOrderBy(
    orderBy: OrderByNode[] | undefined,
    plan: HydrationPlan,
    projectionAliases: Map<string, string>,
    baseAlias: string,
    availableColumns: Set<string>
  ): OrderByNode[] | undefined | null {
    if (!orderBy || orderBy.length === 0) {
      return undefined;
    }

    const mapped: OrderByNode[] = [];

    for (const ob of orderBy) {
      const mappedTerm = this.mapOrderingTerm(ob.term, plan, projectionAliases, baseAlias, availableColumns);
      if (!mappedTerm) return null;

      mapped.push({ ...ob, term: mappedTerm });
    }

    return mapped;
  }

  /**
   * Maps a single ordering term to use base CTE alias
   * @param term - Ordering term to map
   * @param plan - Hydration plan
   * @param projectionAliases - Map of column aliases
   * @param baseAlias - Base CTE alias
   * @param availableColumns - Set of available column names
   * @returns Mapped term or null if cannot map
   */
  private mapOrderingTerm(
    term: OrderByNode['term'],
    plan: HydrationPlan,
    projectionAliases: Map<string, string>,
    baseAlias: string,
    availableColumns: Set<string>
  ): OrderByNode['term'] | null {
    if (term.type === 'Column') {
      const col = term as ColumnNode;
      if (col.table !== plan.rootTable) return null;
      const alias = projectionAliases.get(`${col.table}.${col.name}`) ?? col.name;
      if (!availableColumns.has(alias)) return null;
      return { type: 'Column', table: baseAlias, name: alias };
    }

    if (term.type === 'AliasRef') {
      const aliasName = term.name;
      if (!availableColumns.has(aliasName)) return null;
      return { type: 'Column', table: baseAlias, name: aliasName };
    }

    return null;
  }

  /**
   * Builds column nodes for paging CTE
   * @param primaryKey - Primary key name
   * @param orderBy - Order by nodes
   * @param tableAlias - Table alias for columns
   * @returns Array of column nodes for paging
   */
  private buildPagingColumns(primaryKey: string, orderBy: OrderByNode[] | undefined, tableAlias: string): ColumnNode[] {
    const columns: ColumnNode[] = [{ type: 'Column', table: tableAlias, name: primaryKey, alias: primaryKey }];

    if (!orderBy) return columns;

    for (const ob of orderBy) {
      const term = ob.term as ColumnNode;
      if (!columns.some(col => col.name === term.name)) {
        columns.push({
          type: 'Column',
          table: tableAlias,
          name: term.name,
          alias: term.name
        });
      }
    }

    return columns;
  }
}
