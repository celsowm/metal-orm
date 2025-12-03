import { TableDef } from '../schema/table';
import { ColumnNode, ExpressionNode, valueToOperand } from '../ast/expression';
import { TableNode, UpdateQueryNode, UpdateAssignmentNode } from '../ast/query';

const createTableNode = (table: TableDef): TableNode => ({
  type: 'Table',
  name: table.name
});

/**
 * Immutable state for UPDATE queries
 */
export class UpdateQueryState {
  public readonly table: TableDef;
  public readonly ast: UpdateQueryNode;

  constructor(table: TableDef, ast?: UpdateQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'UpdateQuery',
      table: createTableNode(table),
      set: []
    };
  }

  private clone(nextAst: UpdateQueryNode): UpdateQueryState {
    return new UpdateQueryState(this.table, nextAst);
  }

  withSet(values: Record<string, unknown>): UpdateQueryState {
    const assignments: UpdateAssignmentNode[] = Object.entries(values).map(([column, value]) => ({
      column: {
        type: 'Column',
        table: this.table.name,
        name: column
      },
      value: valueToOperand(value)
    }));

    return this.clone({
      ...this.ast,
      set: assignments
    });
  }

  withWhere(expr: ExpressionNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  withReturning(columns: ColumnNode[]): UpdateQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }
}
