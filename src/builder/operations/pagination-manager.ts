import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

/**
 * Manages pagination operations (LIMIT and OFFSET) for queries
 */
export class PaginationManager {
  /**
   * Creates a new PaginationManager instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Adds a LIMIT clause to the query
   * @param context - Current query context
   * @param value - Maximum number of rows to return
   * @returns Updated query context with LIMIT clause
   */
  limit(context: SelectQueryBuilderContext, value: number): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withLimit(value);
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Adds an OFFSET clause to the query
   * @param context - Current query context
   * @param value - Number of rows to skip
   * @returns Updated query context with OFFSET clause
   */
  offset(context: SelectQueryBuilderContext, value: number): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withOffset(value);
    return { state: nextState, hydration: context.hydration };
  }
}
