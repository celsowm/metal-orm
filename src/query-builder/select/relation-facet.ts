import { ExpressionNode } from '../../core/ast/expression.js';
import { JoinKind } from '../../core/sql/sql.js';
import { SelectQueryBuilderContext } from '../select-query-builder-deps.js';
import { RelationManager } from '../relation-manager.js';
import { RelationIncludeOptions } from '../relation-types.js';
import { SelectQueryNode } from '../../core/ast/query.js';

/**
 * Facet responsible for relation operations (include, match, whereHas, etc.)
 */
export class SelectRelationFacet {
    constructor(private readonly relationManager: RelationManager) { }

    match(
        context: SelectQueryBuilderContext,
        relationName: string,
        predicate?: ExpressionNode
    ): SelectQueryBuilderContext {
        return this.relationManager.match(context, relationName, predicate);
    }

    joinRelation(
        context: SelectQueryBuilderContext,
        relationName: string,
        joinKind: JoinKind,
        extraCondition?: ExpressionNode
    ): SelectQueryBuilderContext {
        return this.relationManager.joinRelation(context, relationName, joinKind, extraCondition);
    }

    include(
        context: SelectQueryBuilderContext,
        relationName: string,
        options?: RelationIncludeOptions
    ): SelectQueryBuilderContext {
        return this.relationManager.include(context, relationName, options);
    }

    applyRelationCorrelation(
        context: SelectQueryBuilderContext,
        relationName: string,
        subAst: SelectQueryNode,
        extraCorrelate?: ExpressionNode
    ): SelectQueryNode {
        return this.relationManager.applyRelationCorrelation(context, relationName, subAst, extraCorrelate);
    }
}
