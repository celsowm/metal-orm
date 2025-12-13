import { OrderingTerm, SelectQueryNode } from '../../ast/query.js';

type TermRenderer = (term: OrderingTerm) => string;

/**
 * Compiler for GROUP BY clauses in SELECT statements.
 * Handles compilation of column grouping expressions.
 */
export class GroupByCompiler {
  /**
   * Compiles GROUP BY clause from a SELECT query AST.
   * @param ast - The SELECT query AST containing grouping columns.
   * @param renderTerm - Function to render a grouping term.
   * @returns SQL GROUP BY clause (e.g., " GROUP BY table.col1, table.col2") or empty string if no grouping.
   */
  static compileGroupBy(ast: SelectQueryNode, renderTerm: TermRenderer): string {
    if (!ast.groupBy || ast.groupBy.length === 0) return '';
    const cols = ast.groupBy.map(renderTerm).join(', ');
    return ` GROUP BY ${cols}`;
  }
}
