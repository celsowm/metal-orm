import { TableDef } from '../schema/table.js';
import { InsertQueryNode, TableNode } from '../core/ast/query.js';
import { ColumnNode, OperandNode, isValueOperandInput, valueToOperand } from '../core/ast/expression.js';
import { buildColumnNodes, createTableNode } from '../core/ast/builders.js';

/**
 * Maintains immutable state for building INSERT queries
 */
export class InsertQueryState {
  public readonly table: TableDef;
  public readonly ast: InsertQueryNode;

  constructor(table: TableDef, ast?: InsertQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'InsertQuery',
      into: createTableNode(table),
      columns: [],
      values: []
    };
  }

  private clone(nextAst: InsertQueryNode): InsertQueryState {
    return new InsertQueryState(this.table, nextAst);
  }

  withValues(rows: Record<string, unknown>[]): InsertQueryState {
    if (!rows.length) return this;

    const definedColumns = this.ast.columns.length
      ? this.ast.columns
      : buildColumnNodes(this.table, Object.keys(rows[0]));

    const newRows: OperandNode[][] = rows.map((row, rowIndex) =>
      definedColumns.map(column => {
        const rawValue = row[column.name];

        if (!isValueOperandInput(rawValue)) {
          throw new Error(
            `Invalid insert value for column "${column.name}" in row ${rowIndex}: only primitives, null, or OperandNodes are allowed`
          );
        }

        return valueToOperand(rawValue);
      })
    );

    return this.clone({
      ...this.ast,
      columns: definedColumns,
      values: [...this.ast.values, ...newRows]
    });
  }

  withReturning(columns: ColumnNode[]): InsertQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }
}
