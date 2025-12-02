import { ColumnDef } from '../../schema/column';
import { CaseExpressionNode, ColumnNode, FunctionNode, SelectQueryNode, WindowFunctionNode } from '../../ast/expression';
import { buildColumnNode } from '../query-ast-service';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

type ColumnSelectionInput = Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>;

export class ColumnSelector {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  select(context: SelectQueryBuilderContext, columns: ColumnSelectionInput): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const { state: nextState, addedColumns } = astService.select(columns);
    return {
      state: nextState,
      hydration: context.hydration.onColumnsSelected(nextState, addedColumns)
    };
  }

  selectRaw(context: SelectQueryBuilderContext, columns: string[]): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.selectRaw(columns).state;
    return { state: nextState, hydration: context.hydration };
  }

  selectSubquery(
    context: SelectQueryBuilderContext,
    alias: string,
    query: SelectQueryNode
  ): SelectQueryBuilderContext {
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.selectSubquery(alias, query);
    return { state: nextState, hydration: context.hydration };
  }

  distinct(context: SelectQueryBuilderContext, columns: (ColumnDef | ColumnNode)[]): SelectQueryBuilderContext {
    const nodes = columns.map(col => buildColumnNode(this.env.table, col));
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withDistinct(nodes);
    return { state: nextState, hydration: context.hydration };
  }
}
