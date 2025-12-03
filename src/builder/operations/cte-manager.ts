import { SelectQueryNode } from '../../ast/query';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

/**
 * Manages Common Table Expressions (CTEs) for query building
 */
export class CteManager {
  /**
   * Creates a new CteManager instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Adds a Common Table Expression (CTE) to the query
   * @param context - Current query context
   * @param name - Name of the CTE
   * @param query - Query for the CTE
   * @param columns - Optional column names for the CTE
   * @param recursive - Whether the CTE is recursive
   * @returns Updated query context with CTE
   */
  withCte(
    context: SelectQueryBuilderContext,
    name: string,
    query: SelectQueryNode,
    columns?: string[],
    recursive = false
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withCte(name, query, columns, recursive);
    return { state: nextState, hydration: context.hydration };
  }
}
