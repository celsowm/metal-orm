import { ColumnDef } from '../../schema/column';
import { ColumnNode, ExpressionNode } from '../../ast/expression';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';
import { OrderDirection } from '../../constants/sql';

export class FilterManager {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  where(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withWhere(expr);
    return { state: nextState, hydration: context.hydration };
  }

  groupBy(context: SelectQueryBuilderContext, column: ColumnDef | ColumnNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withGroupBy(column);
    return { state: nextState, hydration: context.hydration };
  }

  having(context: SelectQueryBuilderContext, expr: ExpressionNode): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withHaving(expr);
    return { state: nextState, hydration: context.hydration };
  }

  orderBy(
    context: SelectQueryBuilderContext,
    column: ColumnDef | ColumnNode,
    direction: OrderDirection
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withOrderBy(column, direction);
    return { state: nextState, hydration: context.hydration };
  }
}
