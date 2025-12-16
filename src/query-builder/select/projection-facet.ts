import { ColumnDef } from '../../schema/column.js';
import { ColumnNode, FunctionNode, CaseExpressionNode, WindowFunctionNode } from '../../core/ast/expression.js';
import { SelectQueryBuilderContext } from '../select-query-builder-deps.js';
import { ColumnSelector } from '../column-selector.js';
import { SelectQueryNode } from '../../core/ast/query.js';

type ColumnSelectionValue = ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode;

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
        return { ...context, state: this.columnSelector.select(context, columns).state };
    }

    /**
     * Selects raw column expressions
     * @param context - Current query context
     * @param cols - Raw column expressions
     * @returns Updated query context with raw column selections
     */
    selectRaw(context: SelectQueryBuilderContext, cols: string[]): SelectQueryBuilderContext {
        return { ...context, state: this.columnSelector.selectRaw(context, cols).state };
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
        return { ...context, state: this.columnSelector.selectSubquery(context, alias, query).state };
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
        return { ...context, state: this.columnSelector.distinct(context, cols).state };
    }
}
