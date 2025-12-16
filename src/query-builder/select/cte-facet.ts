import { SelectQueryNode } from '../../core/ast/query.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';
import { SelectQueryState } from '../select-query-state.js';

/**
 * Facet responsible for Common Table Expressions (WITH clauses)
 */
export class SelectCTEFacet {
    /**
     * Creates a new SelectCTEFacet instance
     * @param env - Query builder environment
     * @param createAstService - Function to create AST service
     */
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

    /**
     * Adds a Common Table Expression to the query
     * @param context - Current query context
     * @param name - CTE name
     * @param subAst - CTE query AST
     * @param columns - Optional column names
     * @param recursive - Whether the CTE is recursive
     * @returns Updated query context with CTE
     */
    withCTE(
        context: SelectQueryBuilderContext,
        name: string,
        subAst: SelectQueryNode,
        columns: string[] | undefined,
        recursive: boolean
    ): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withCte(name, subAst, columns, recursive);
        return { state: nextState, hydration: context.hydration };
    }
}
