import { SelectQueryNode, SetOperationKind } from '../../core/ast/query.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';

/**
 * Facet responsible for set operations (UNION, INTERSECT, EXCEPT)
 */
export class SelectSetOpFacet {
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: any) => QueryAstService
    ) { }

    applySetOperation(
        context: SelectQueryBuilderContext,
        operator: SetOperationKind,
        subAst: SelectQueryNode
    ): SelectQueryBuilderContext {
        const astService = this.createAstService(context.state);
        const nextState = astService.withSetOperation(operator, subAst);
        return { state: nextState, hydration: context.hydration };
    }
}
