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
    constructor(private readonly columnSelector: ColumnSelector) { }

    select(
        context: SelectQueryBuilderContext,
        columns: Record<string, ColumnSelectionValue>
    ): SelectQueryBuilderContext {
        return { ...context, state: this.columnSelector.select(context, columns).state };
    }

    selectRaw(context: SelectQueryBuilderContext, cols: string[]): SelectQueryBuilderContext {
        return { ...context, state: this.columnSelector.selectRaw(context, cols).state };
    }

    selectSubquery(
        context: SelectQueryBuilderContext,
        alias: string,
        query: SelectQueryNode
    ): SelectQueryBuilderContext {
        return { ...context, state: this.columnSelector.selectSubquery(context, alias, query).state };
    }

    distinct(
        context: SelectQueryBuilderContext,
        cols: (ColumnDef | ColumnNode)[]
    ): SelectQueryBuilderContext {
        return { ...context, state: this.columnSelector.distinct(context, cols).state };
    }
}
