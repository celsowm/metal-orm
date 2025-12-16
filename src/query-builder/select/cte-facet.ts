import { SelectQueryNode } from '../../core/ast/query.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';
import { SelectQueryState } from '../select-query-state.js';

/**
 * Facet responsible for Common Table Expressions (WITH clauses)
 */
export class SelectCTEFacet {
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

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
