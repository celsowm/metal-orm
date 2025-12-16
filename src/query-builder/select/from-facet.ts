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
    /**
     * Creates a new SelectFromFacet instance
     * @param env - Query builder environment
     * @param createAstService - Function to create AST service
     */
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

    /**
     * Applies an alias to the FROM table
     * @param context - Current query context
     * @param alias - Alias to apply
     * @returns Updated query context with aliased FROM
     */
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

    /**
     * Sets the FROM clause to a subquery
     * @param context - Current query context
     * @param subAst - Subquery AST
     * @param alias - Alias for the subquery
     * @param columnAliases - Optional column aliases
     * @returns Updated query context with subquery FROM
     */
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

    /**
     * Sets the FROM clause to a function table
     * @param context - Current query context
     * @param name - Function name
     * @param args - Function arguments
     * @param alias - Optional alias for the function table
     * @param options - Optional function table options
     * @returns Updated query context with function table FROM
     */
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
