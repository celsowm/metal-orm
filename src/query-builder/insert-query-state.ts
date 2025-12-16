import { TableDef } from '../schema/table.js';
import { InsertQueryNode, SelectQueryNode } from '../core/ast/query.js';
import {
  ColumnNode,
  OperandNode,
  isValueOperandInput,
  valueToOperand
} from '../core/ast/expression.js';
import {
  buildColumnNodes,
  createTableNode
} from '../core/ast/builders.js';

type InsertRows = Record<string, unknown>[];

/**
 * Maintains immutable state for building INSERT queries
 */
export class InsertQueryState {
  public readonly table: TableDef;
  public readonly ast: InsertQueryNode;

  /**
   * Creates a new InsertQueryState instance
   * @param table - The table definition for the INSERT query
   * @param ast - Optional initial AST node, defaults to a basic INSERT query
   */
  constructor(table: TableDef, ast?: InsertQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'InsertQuery',
      into: createTableNode(table),
      columns: [],
      source: {
        type: 'InsertValues',
        rows: []
      }
    };
  }

  private clone(nextAst: InsertQueryNode): InsertQueryState {
    return new InsertQueryState(this.table, nextAst);
  }

  private ensureColumnsFromRow(rows: InsertRows): ColumnNode[] {
    if (this.ast.columns.length) return this.ast.columns;
    return buildColumnNodes(this.table, Object.keys(rows[0]));
  }

  private appendValues(rows: OperandNode[][]): OperandNode[][] {
    if (this.ast.source.type === 'InsertValues') {
      return [...this.ast.source.rows, ...rows];
    }
    return rows;
  }

  private getTableColumns(): ColumnNode[] {
    const names = Object.keys(this.table.columns);
    if (!names.length) return [];
    return buildColumnNodes(this.table, names);
  }

  /**
   * Adds VALUES clause to the INSERT query
   * @param rows - Array of row objects to insert
   * @returns A new InsertQueryState with the VALUES clause added
   * @throws Error if mixing VALUES with SELECT source
   * @throws Error if invalid values are provided
   */
  withValues(rows: Record<string, unknown>[]): InsertQueryState {
    if (!rows.length) return this;

    if (this.ast.source.type === 'InsertSelect') {
      throw new Error('Cannot mix INSERT ... VALUES with INSERT ... SELECT source.');
    }

    const definedColumns = this.ensureColumnsFromRow(rows);

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
      source: {
        type: 'InsertValues',
        rows: this.appendValues(newRows)
      }
    });
  }

  /**
   * Sets the columns for the INSERT query
   * @param columns - Column nodes to insert into
   * @returns A new InsertQueryState with the specified columns
   */
  withColumns(columns: ColumnNode[]): InsertQueryState {
    if (!columns.length) return this;
    return this.clone({
      ...this.ast,
      columns: [...columns]
    });
  }

  /**
   * Adds SELECT source to the INSERT query
   * @param query - The SELECT query to use as source
   * @param columns - Target columns for the INSERT
   * @returns A new InsertQueryState with the SELECT source
   * @throws Error if mixing SELECT with VALUES source
   * @throws Error if no destination columns specified
   */
  withSelect(query: SelectQueryNode, columns: ColumnNode[]): InsertQueryState {
    const targetColumns =
      columns.length
        ? columns
        : this.ast.columns.length
          ? this.ast.columns
          : this.getTableColumns();

    if (!targetColumns.length) {
      throw new Error('INSERT ... SELECT requires specifying destination columns.');
    }

    if (this.ast.source.type === 'InsertValues' && this.ast.source.rows.length) {
      throw new Error('Cannot mix INSERT ... SELECT with INSERT ... VALUES source.');
    }

    return this.clone({
      ...this.ast,
      columns: [...targetColumns],
      source: {
        type: 'InsertSelect',
        query
      }
    });
  }

  /**
   * Adds a RETURNING clause to the INSERT query
   * @param columns - Columns to return after insertion
   * @returns A new InsertQueryState with the RETURNING clause added
   */
  withReturning(columns: ColumnNode[]): InsertQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }
}
