import { TableDef } from '../schema/table';
import { InsertQueryNode, TableNode } from '../ast/query';
import { ColumnNode, OperandNode, valueToOperand } from '../ast/expression';

const createTableNode = (table: TableDef): TableNode => ({
  type: 'Table',
  name: table.name
});

const buildColumnNodes = (table: TableDef, names: string[]): ColumnNode[] =>
  names.map(name => ({
    type: 'Column',
    table: table.name,
    name
  }));

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

    const newRows: OperandNode[][] = rows.map(row =>
      definedColumns.map(column => valueToOperand(row[column.name]))
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
