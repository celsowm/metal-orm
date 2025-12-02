import { SelectQueryNode } from '../../ast/query';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

export class CteManager {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  withCte(
    context: SelectQueryBuilderContext,
    name: string,
    query: SelectQueryNode,
    columns?: string[],
    recursive = false
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withCte(name, query, columns, recursive);
    return { state: nextState, hydration: context.hydration };
  }
}
