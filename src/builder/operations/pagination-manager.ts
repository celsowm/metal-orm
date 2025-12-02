import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

export class PaginationManager {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  limit(context: SelectQueryBuilderContext, value: number): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withLimit(value);
    return { state: nextState, hydration: context.hydration };
  }

  offset(context: SelectQueryBuilderContext, value: number): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withOffset(value);
    return { state: nextState, hydration: context.hydration };
  }
}
