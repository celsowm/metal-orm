import { TableDef } from '../schema/table';
import { SelectQueryNode, CommonTableExpressionNode, OrderByNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode
} from '../ast/expression';
import { JoinNode } from '../ast/join';

export type ProjectionNode =
  | ColumnNode
  | FunctionNode
  | ScalarSubqueryNode
  | CaseExpressionNode
  | WindowFunctionNode;

export class SelectQueryState {
  public readonly table: TableDef;
  public readonly ast: SelectQueryNode;

  constructor(table: TableDef, ast?: SelectQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'SelectQuery',
      from: { type: 'Table', name: table.name },
      columns: [],
      joins: []
    };
  }

  private clone(nextAst: SelectQueryNode): SelectQueryState {
    return new SelectQueryState(this.table, nextAst);
  }

  withColumns(newCols: ProjectionNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      columns: [...(this.ast.columns ?? []), ...newCols]
    });
  }

  withJoin(join: JoinNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

  withWhere(predicate: ExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      where: predicate
    });
  }

  withHaving(predicate: ExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      having: predicate
    });
  }

  withGroupBy(columns: ColumnNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      groupBy: [...(this.ast.groupBy ?? []), ...columns]
    });
  }

  withOrderBy(orderBy: OrderByNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      orderBy: [...(this.ast.orderBy ?? []), ...orderBy]
    });
  }

  withDistinct(columns: ColumnNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      distinct: [...(this.ast.distinct ?? []), ...columns]
    });
  }

  withLimit(limit: number): SelectQueryState {
    return this.clone({
      ...this.ast,
      limit
    });
  }

  withOffset(offset: number): SelectQueryState {
    return this.clone({
      ...this.ast,
      offset
    });
  }

  withCte(cte: CommonTableExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      ctes: [...(this.ast.ctes ?? []), cte]
    });
  }
}
