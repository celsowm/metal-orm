import { ExpressionNode } from '../../ast/expression';
import { SelectQueryNode } from '../../ast/query';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

export interface RelationIncludeOptions {
  columns?: string[];
  aliasPrefix?: string;
  filter?: ExpressionNode;
  joinKind?: 'LEFT' | 'INNER';
}

export class RelationManager {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  match(context: SelectQueryBuilderContext, relationName: string, predicate?: ExpressionNode): SelectQueryBuilderContext {
    const result = this.createService(context).match(relationName, predicate);
    return { state: result.state, hydration: result.hydration };
  }

  joinRelation(
    context: SelectQueryBuilderContext,
    relationName: string,
    joinKind: 'INNER' | 'LEFT' | 'RIGHT',
    extraCondition?: ExpressionNode
  ): SelectQueryBuilderContext {
    const result = this.createService(context).joinRelation(relationName, joinKind, extraCondition);
    return { state: result.state, hydration: result.hydration };
  }

  include(
    context: SelectQueryBuilderContext,
    relationName: string,
    options?: RelationIncludeOptions
  ): SelectQueryBuilderContext {
    const result = this.createService(context).include(relationName, options);
    return { state: result.state, hydration: result.hydration };
  }

  applyRelationCorrelation(context: SelectQueryBuilderContext, relationName: string, ast: SelectQueryNode): SelectQueryNode {
    return this.createService(context).applyRelationCorrelation(relationName, ast);
  }

  private createService(context: SelectQueryBuilderContext) {
    return this.env.deps.createRelationService(this.env.table, context.state, context.hydration);
  }
}
