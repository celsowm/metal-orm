import { TableDef } from '../../schema/table.js';
import { BinaryExpressionNode } from '../../core/ast/expression.js';
import { SelectQueryNode } from '../../core/ast/query.js';
import { JoinKind } from '../../core/sql/sql.js';
import { derivedTable, fnTable } from '../../core/ast/builders.js';
import { createJoinNode } from '../../core/ast/join-node.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { QueryAstService } from '../query-ast-service.js';
import { OperandNode } from '../../core/ast/expression.js';
import { SelectQueryState } from '../select-query-state.js';

/**
 * Facet responsible for JOIN operations
 */
export class SelectJoinFacet {
    constructor(
        private readonly env: SelectQueryBuilderEnvironment,
        private readonly createAstService: (state: SelectQueryState) => QueryAstService
    ) { }

    applyJoin(
        context: SelectQueryBuilderContext,
        table: TableDef,
        condition: BinaryExpressionNode | undefined,
        kind: JoinKind
    ): SelectQueryBuilderContext {
        const joinNode = createJoinNode(kind, { type: 'Table', name: table.name, schema: table.schema }, condition);
        const astService = this.createAstService(context.state);
        const nextState = astService.withJoin(joinNode);
        return { state: nextState, hydration: context.hydration };
    }

    joinSubquery(
        context: SelectQueryBuilderContext,
        subAst: SelectQueryNode,
        alias: string,
        condition: BinaryExpressionNode,
        joinKind: JoinKind,
        columnAliases?: string[]
    ): SelectQueryBuilderContext {
        const joinNode = createJoinNode(joinKind, derivedTable(subAst, alias, columnAliases), condition);
        const astService = this.createAstService(context.state);
        const nextState = astService.withJoin(joinNode);
        return { state: nextState, hydration: context.hydration };
    }

    joinFunctionTable(
        context: SelectQueryBuilderContext,
        name: string,
        args: OperandNode[],
        alias: string,
        condition: BinaryExpressionNode,
        joinKind: JoinKind,
        options?: { lateral?: boolean; withOrdinality?: boolean; columnAliases?: string[]; schema?: string }
    ): SelectQueryBuilderContext {
        const functionTable = fnTable(name, args, alias, options);
        const joinNode = createJoinNode(joinKind, functionTable, condition);
        const astService = this.createAstService(context.state);
        const nextState = astService.withJoin(joinNode);
        return { state: nextState, hydration: context.hydration };
    }
}
