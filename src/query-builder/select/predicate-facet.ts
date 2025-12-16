import { ColumnDef } from '../../schema/column.js';
import { ExpressionNode } from '../../core/ast/expression.js';
import { OrderingTerm } from '../../core/ast/query.js';
import { OrderDirection } from '../../core/sql/sql.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';

/**
 * Facet responsible for filtering and ordering operations
 */
export class SelectPredicateFacet {
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: any) => QueryAstService
    ) { }

    where(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withWhere(expr);
        return { state: nextState, hydration: context.hydration };
    }

    groupBy(context: SelectQueryBuilderContext, term: ColumnDef | OrderingTerm): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withGroupBy(term);
        return { state: nextState, hydration: context.hydration };
    }

    having(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withHaving(expr);
        return { state: nextState, hydration: context.hydration };
    }

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

    limit(context: SelectQueryBuilderContext, n: number): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withLimit(n);
        return { state: nextState, hydration: context.hydration };
    }

    offset(context: SelectQueryBuilderContext, n: number): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withOffset(n);
        return { state: nextState, hydration: context.hydration };
    }
}
