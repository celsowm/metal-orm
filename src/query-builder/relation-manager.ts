import { ExpressionNode } from '../core/ast/expression';
import { SelectQueryNode } from '../core/ast/query';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from './select-query-builder-deps';
import { JoinKind } from '../core/sql/sql';
import { RelationIncludeOptions } from './relation-types';

/**
 * Manages relation operations (joins, includes, etc.) for query building
 */
export class RelationManager {
  /**
   * Creates a new RelationManager instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Matches records based on a relation with an optional predicate
   * @param context - Current query context
   * @param relationName - Name of the relation to match
   * @param predicate - Optional predicate expression
   * @returns Updated query context with relation match
   */
  match(context: SelectQueryBuilderContext, relationName: string, predicate?: ExpressionNode): SelectQueryBuilderContext {
    const result = this.createService(context).match(relationName, predicate);
    return { state: result.state, hydration: result.hydration };
  }

  /**
   * Joins a relation to the query
   * @param context - Current query context
   * @param relationName - Name of the relation to join
   * @param joinKind - Type of join to use
   * @param extraCondition - Additional join condition
   * @returns Updated query context with relation join
   */
  joinRelation(
    context: SelectQueryBuilderContext,
    relationName: string,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode
  ): SelectQueryBuilderContext {
    const result = this.createService(context).joinRelation(relationName, joinKind, extraCondition);
    return { state: result.state, hydration: result.hydration };
  }

  /**
   * Includes a relation in the query result
   * @param context - Current query context
   * @param relationName - Name of the relation to include
   * @param options - Options for relation inclusion
   * @returns Updated query context with included relation
   */
  include(
    context: SelectQueryBuilderContext,
    relationName: string,
    options?: RelationIncludeOptions
  ): SelectQueryBuilderContext {
    const result = this.createService(context).include(relationName, options);
    return { state: result.state, hydration: result.hydration };
  }

  /**
   * Applies relation correlation to a query AST
   * @param context - Current query context
   * @param relationName - Name of the relation
   * @param ast - Query AST to modify
   * @returns Modified query AST with relation correlation
   */
  applyRelationCorrelation(context: SelectQueryBuilderContext, relationName: string, ast: SelectQueryNode): SelectQueryNode {
    return this.createService(context).applyRelationCorrelation(relationName, ast);
  }

  /**
   * Creates a relation service instance
   * @param context - Current query context
   * @returns Relation service instance
   */
  private createService(context: SelectQueryBuilderContext) {
    return this.env.deps.createRelationService(this.env.table, context.state, context.hydration);
  }
}
