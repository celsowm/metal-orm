import { ColumnDef } from '../../schema/column.js';
import { ExpressionNode } from '../../core/ast/expression.js';
import { OrderingTerm } from '../../core/ast/query.js';
import { OrderDirection } from '../../core/sql/sql.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';
import { SelectQueryState } from '../select-query-state.js';

/**
 * Facet responsible for filtering and ordering operations
 */
export class SelectPredicateFacet {
    /**
     * Creates a new SelectPredicateFacet instance
     * @param env - Query builder environment
     * @param createAstService - Function to create AST service
     */
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

    /**
     * Adds a WHERE condition to the query
     * @param context - Current query context
     * @param expr - WHERE expression
     * @returns Updated query context with WHERE condition
     */
    where(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withWhere(expr);
        return { state: nextState, hydration: context.hydration };
    }

    /**
     * Adds a GROUP BY clause to the query
     * @param context - Current query context
     * @param term - Column or ordering term to group by
     * @returns Updated query context with GROUP BY clause
     */
    groupBy(context: SelectQueryBuilderContext, term: ColumnDef | OrderingTerm): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withGroupBy(term);
        return { state: nextState, hydration: context.hydration };
    }

    /**
     * Adds a HAVING condition to the query
     * @param context - Current query context
     * @param expr - HAVING expression
     * @returns Updated query context with HAVING condition
     */
    having(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withHaving(expr);
        return { state: nextState, hydration: context.hydration };
    }

    /**
     * Adds an ORDER BY clause to the query
     * @param context - Current query context
     * @param term - Column or ordering term to order by
     * @param direction - Order direction
     * @param nulls - Nulls ordering
     * @param collation - Collation
     * @returns Updated query context with ORDER BY clause
     */
    orderBy(
        context: SelectQueryBuilderContext,
        term: ColumnDef | OrderingTerm,
        direction: OrderDirection,
        nulls?: 'FIRST' | 'LAST',
        collation?: string
    ): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withOrderBy(term, direction, nulls, collation);
        return { state: nextState, hydration: context.hydration };
    }

    /**
     * Adds a LIMIT clause to the query
     * @param context - Current query context
     * @param n - Maximum number of rows
     * @returns Updated query context with LIMIT clause
     */
    limit(context: SelectQueryBuilderContext, n: number): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withLimit(n);
        return { state: nextState, hydration: context.hydration };
    }

    /**
     * Adds an OFFSET clause to the query
     * @param context - Current query context
     * @param n - Number of rows to skip
     * @returns Updated query context with OFFSET clause
     */
    offset(context: SelectQueryBuilderContext, n: number): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withOffset(n);
        return { state: nextState, hydration: context.hydration };
    }
}
