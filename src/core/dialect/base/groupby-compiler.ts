import { SelectQueryNode } from '../../ast/query.js';

/**
 * Compiler for GROUP BY clauses in SELECT statements.
 * Handles compilation of column grouping expressions.
 */
export class GroupByCompiler {
  /**
   * Compiles GROUP BY clause from a SELECT query AST.
   * @param ast - The SELECT query AST containing grouping columns.
   * @param quoteIdentifier - Function to quote identifiers according to dialect rules.
   * @returns SQL GROUP BY clause (e.g., " GROUP BY table.col1, table.col2") or empty string if no grouping.
   */
  static compileGroupBy(ast: SelectQueryNode, quoteIdentifier: (id: string) => string): string {
    if (!ast.groupBy || ast.groupBy.length === 0) return '';
    const cols = ast.groupBy
      .map(c => `${quoteIdentifier(c.table)}.${quoteIdentifier(c.name)}`)
      .join(', ');
    return ` GROUP BY ${cols}`;
  }
}
