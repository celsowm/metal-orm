import { SelectQueryNode } from '../../ast/query.js';

/**
 * Compiler for ORDER BY clauses in SELECT statements.
 * Handles compilation of sorting expressions with direction (ASC/DESC).
 */
export class OrderByCompiler {
  /**
   * Compiles ORDER BY clause from a SELECT query AST.
   * @param ast - The SELECT query AST containing sort specifications.
   * @param quoteIdentifier - Function to quote identifiers according to dialect rules.
   * @returns SQL ORDER BY clause (e.g., " ORDER BY table.col1 ASC, table.col2 DESC") or empty string if no ordering.
   */
  static compileOrderBy(ast: SelectQueryNode, quoteIdentifier: (id: string) => string): string {
    if (!ast.orderBy || ast.orderBy.length === 0) return '';
    const parts = ast.orderBy
      .map(o => `${quoteIdentifier(o.column.table)}.${quoteIdentifier(o.column.name)} ${o.direction}`)
      .join(', ');
    return ` ORDER BY ${parts}`;
  }
}
