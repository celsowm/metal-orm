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
    /**
     * Creates a new SelectRelationFacet instance
     * @param relationManager - Relation manager dependency
     */
    constructor(private readonly relationManager: RelationManager) { }

    /**
     * Matches records based on a relationship
     * @param context - Current query context
     * @param relationName - Name of the relationship
     * @param predicate - Optional predicate
     * @returns Updated query context with relation match
     */
    match(
        context: SelectQueryBuilderContext,
        relationName: string,
        predicate?: ExpressionNode
    ): SelectQueryBuilderContext {
        return this.relationManager.match(context, relationName, predicate);
    }

    /**
     * Joins a related table
     * @param context - Current query context
     * @param relationName - Name of the relationship
     * @param joinKind - Type of join
     * @param extraCondition - Optional additional condition
     * @returns Updated query context with relation join
     */
    joinRelation(
        context: SelectQueryBuilderContext,
        relationName: string,
        joinKind: JoinKind,
        extraCondition?: ExpressionNode
    ): SelectQueryBuilderContext {
        return this.relationManager.joinRelation(context, relationName, joinKind, extraCondition);
    }

    /**
     * Includes related data in the query results
     * @param context - Current query context
     * @param relationName - Name of the relationship to include
     * @param options - Optional include options
     * @returns Updated query context with relation inclusion
     */
    include(
        context: SelectQueryBuilderContext,
        relationName: string,
        options?: RelationIncludeOptions
    ): SelectQueryBuilderContext {
        return this.relationManager.include(context, relationName, options);
    }

    /**
     * Applies correlation for relation-based subqueries
     * @param context - Current query context
     * @param relationName - Name of the relationship
     * @param subAst - Subquery AST
     * @param extraCorrelate - Optional additional correlation
     * @returns Modified subquery AST with correlation
     */
    applyRelationCorrelation(
        context: SelectQueryBuilderContext,
        relationName: string,
        subAst: SelectQueryNode,
        extraCorrelate?: ExpressionNode
    ): SelectQueryNode {
        return this.relationManager.applyRelationCorrelation(context, relationName, subAst, extraCorrelate);
    }
}
