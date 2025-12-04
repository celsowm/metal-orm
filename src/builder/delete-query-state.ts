import { TableDef } from '../schema/table';
import { ColumnNode, ExpressionNode } from '../ast/expression';
import { TableNode, DeleteQueryNode } from '../ast/query';
import { createTableNode } from '../ast/builders';

/**
 * Maintains immutable state for DELETE queries
 */
export class DeleteQueryState {
  public readonly table: TableDef;
  public readonly ast: DeleteQueryNode;

  constructor(table: TableDef, ast?: DeleteQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'DeleteQuery',
      from: createTableNode(table)
    };
  }

  private clone(nextAst: DeleteQueryNode): DeleteQueryState {
    return new DeleteQueryState(this.table, nextAst);
  }

  withWhere(expr: ExpressionNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  withReturning(columns: ColumnNode[]): DeleteQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }
}
