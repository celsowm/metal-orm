import { ColumnDef } from '../../schema/column-types.js';
import {
  ColumnNode,
  FunctionNode,
  CaseExpressionNode,
  CastExpressionNode,
  WindowFunctionNode,
  ArithmeticExpressionNode,
  BitwiseExpressionNode
} from '../../core/ast/expression.js';
import { SelectQueryBuilderContext } from '../select-query-builder-deps.js';
import { ColumnSelector } from '../column-selector.js';
import { SelectQueryNode } from '../../core/ast/query.js';

type ColumnSelectionValue =
  | ColumnDef
  | FunctionNode
  | CaseExpressionNode
  | CastExpressionNode
  | WindowFunctionNode
  | ArithmeticExpressionNode
  | BitwiseExpressionNode;

/**
 * Facet responsible for projection operations (SELECT, DISTINCT, etc.)
 */
export class SelectProjectionFacet {
    /**
     * Creates a new SelectProjectionFacet instance
     * @param columnSelector - Column selector dependency
     */
    constructor(private readonly columnSelector: ColumnSelector) { }

    /**
     * Selects columns for the query
     * @param context - Current query context
     * @param columns - Columns to select
     * @returns Updated query context with selected columns
     */
    select(
        context: SelectQueryBuilderContext,
        columns: Record<string, ColumnSelectionValue>
    ): SelectQueryBuilderContext {
        return this.columnSelector.select(context, columns);
    }

    /**
     * Selects raw column expressions
     * @param context - Current query context
     * @param cols - Raw column expressions
     * @returns Updated query context with raw column selections
     */
    selectRaw(context: SelectQueryBuilderContext, cols: string[]): SelectQueryBuilderContext {
        return this.columnSelector.selectRaw(context, cols);
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
        return this.columnSelector.selectSubquery(context, alias, query);
    }

    /**
     * Adds DISTINCT clause to the query
     * @param context - Current query context
     * @param cols - Columns to make distinct
     * @returns Updated query context with DISTINCT clause
     */
    distinct(
        context: SelectQueryBuilderContext,
        cols: (ColumnDef | ColumnNode)[]
    ): SelectQueryBuilderContext {
        return this.columnSelector.distinct(context, cols);
    }
}

