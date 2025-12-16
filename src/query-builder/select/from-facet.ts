import { SelectQueryNode } from '../../core/ast/query.js';
import { OperandNode } from '../../core/ast/expression.js';
import { derivedTable, fnTable } from '../../core/ast/builders.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';
import { SelectQueryState } from '../select-query-state.js';

/**
 * Facet responsible for FROM clause operations
 */
export class SelectFromFacet {
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

    as(context: SelectQueryBuilderContext, alias: string): SelectQueryBuilderContext {
        const from = context.state.ast.from;
        if (from.type !== 'Table') {
            throw new Error('Cannot alias non-table FROM sources');
        }
        const nextFrom = { ...from, alias };
        const astService = this.createAstService(context.state);
        const nextState = astService.withFrom(nextFrom);
        return { state: nextState, hydration: context.hydration };
    }

    fromSubquery(
        context: SelectQueryBuilderContext,
        subAst: SelectQueryNode,
        alias: string,
        columnAliases?: string[]
    ): SelectQueryBuilderContext {
        const fromNode = derivedTable(subAst, alias, columnAliases);
        const astService = this.createAstService(context.state);
        const nextState = astService.withFrom(fromNode);
        return { state: nextState, hydration: context.hydration };
    }

    fromFunctionTable(
        context: SelectQueryBuilderContext,
        name: string,
        args: OperandNode[],
        alias?: string,
        options?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
    ): SelectQueryBuilderContext {
        const functionTable = fnTable(name, args, alias, options);
        const astService = this.createAstService(context.state);
        const nextState = astService.withFrom(functionTable);
        return { state: nextState, hydration: context.hydration };
    }
}
