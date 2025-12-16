import { ColumnNode } from '../core/ast/expression.js';
import { CommonTableExpressionNode } from '../core/ast/query.js';

/**
 * Best-effort helper that tries to convert a raw column expression into a `ColumnNode`.
 * This parser is intentionally limited; use it only for simple references or function calls.
 *
 * @param col - Raw column expression string (e.g., "column", "table.column", "COUNT(column)")
 * @param tableName - Default table name to use when no table is specified
 * @param ctes - Optional array of CTEs for context when parsing column references
 * @returns A ColumnNode representing the parsed column expression
 */
export const parseRawColumn = (
  col: string,
  tableName: string,
  ctes?: CommonTableExpressionNode[]
): ColumnNode => {
  if (col.includes('(')) {
    const [_fn, rest] = col.split('(');
    void _fn;
    const colName = rest.replace(')', '');
    const [table, name] = colName.includes('.') ? colName.split('.') : [tableName, colName];
    return { type: 'Column', table, name, alias: col };
  }

  if (col.includes('.')) {
    const [potentialCteName, columnName] = col.split('.');
    const hasCte = ctes?.some(cte => cte.name === potentialCteName);

    if (hasCte) {
      return { type: 'Column', table: tableName, name: col };
    }

    return { type: 'Column', table: potentialCteName, name: columnName };
  }

  return { type: 'Column', table: tableName, name: col };
};
