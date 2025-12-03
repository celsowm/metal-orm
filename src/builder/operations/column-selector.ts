import { ColumnDef } from '../../schema/column';
import { CaseExpressionNode, ColumnNode, FunctionNode, WindowFunctionNode } from '../../ast/expression';
import { SelectQueryNode } from '../../ast/query';
import { buildColumnNode } from '../query-ast-service';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

/**
 * Type for column selection input
 */
type ColumnSelectionInput = Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>;

/**
 * Handles column selection operations for the query builder
 */
export class ColumnSelector {
  /**
   * Creates a new ColumnSelector instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Selects columns for the query
   * @param context - Current query context
   * @param columns - Columns to select
   * @returns Updated query context with selected columns
   */
  select(context: SelectQueryBuilderContext, columns: ColumnSelectionInput): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const { state: nextState, addedColumns } = astService.select(columns);
    return {
      state: nextState,
      hydration: context.hydration.onColumnsSelected(nextState, addedColumns)
    };
  }

  /**
   * Selects raw column expressions
   * @param context - Current query context
   * @param columns - Raw column expressions
   * @returns Updated query context with raw column selections
   */
  selectRaw(context: SelectQueryBuilderContext, columns: string[]): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.selectRaw(columns).state;
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Selects a subquery as a column
   * @param context - Current query context
   * @param alias - Alias for the subquery
   * @param query - Subquery to select
   * @returns Updated query context with subquery selection
   */
  selectSubquery(
    context: SelectQueryBuilderContext,
    alias: string,
    query: SelectQueryNode
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.selectSubquery(alias, query);
    return { state: nextState, hydration: context.hydration };
  }

  /**
   * Adds DISTINCT clause to the query
   * @param context - Current query context
   * @param columns - Columns to make distinct
   * @returns Updated query context with DISTINCT clause
   */
  distinct(context: SelectQueryBuilderContext, columns: (ColumnDef | ColumnNode)[]): SelectQueryBuilderContext {
    const nodes = columns.map(col => buildColumnNode(this.env.table, col));
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withDistinct(nodes);
    return { state: nextState, hydration: context.hydration };
  }
}
