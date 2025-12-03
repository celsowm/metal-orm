import { ColumnDef } from '../../schema/column';
import { ColumnNode, ExpressionNode } from '../../ast/expression';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';
import { OrderDirection } from '../../constants/sql';

/**
 * Manages filtering, ordering, and grouping operations for queries
 */
export class FilterManager {
  /**
   * Creates a new FilterManager instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Adds a WHERE clause to the query
   * @param context - Current query context
   * @param expr - Expression for the WHERE clause
   * @returns Updated query context with WHERE clause
   */
  where(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withWhere(expr);
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Adds a GROUP BY clause to the query
   * @param context - Current query context
   * @param column - Column to group by
   * @returns Updated query context with GROUP BY clause
   */
  groupBy(context: SelectQueryBuilderContext, column: ColumnDef | ColumnNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withGroupBy(column);
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Adds a HAVING clause to the query
   * @param context - Current query context
   * @param expr - Expression for the HAVING clause
   * @returns Updated query context with HAVING clause
   */
  having(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withHaving(expr);
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Adds an ORDER BY clause to the query
   * @param context - Current query context
   * @param column - Column to order by
   * @param direction - Order direction (ASC/DESC)
   * @returns Updated query context with ORDER BY clause
   */
  orderBy(
    context: SelectQueryBuilderContext,
    column: ColumnDef | ColumnNode,
    direction: OrderDirection
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withOrderBy(column, direction);
    return { state: nextState, hydration: context.hydration };
  }
}
