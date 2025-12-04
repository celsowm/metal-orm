import { TableDef } from '../schema/table.js';
import { ColumnNode, ExpressionNode, valueToOperand } from '../core/ast/expression.js';
import { TableNode, UpdateQueryNode, UpdateAssignmentNode } from '../core/ast/query.js';
import { createTableNode } from '../core/ast/builders.js';

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
