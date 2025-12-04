import { ColumnNode } from '../core/ast/expression';
import { CommonTableExpressionNode } from '../core/ast/query';

/**
 * Best-effort helper that tries to convert a raw column expression into a `ColumnNode`.
 * This parser is intentionally limited; use it only for simple references or function calls.
 */
export const parseRawColumn = (
  col: string,
  tableName: string,
  ctes?: CommonTableExpressionNode[]
): ColumnNode => {
  if (col.includes('(')) {
    const [fn, rest] = col.split('(');
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
