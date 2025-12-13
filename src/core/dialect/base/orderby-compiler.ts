import { OrderByNode, SelectQueryNode } from '../../ast/query.js';

type NullsRenderer = (order: OrderByNode) => string | undefined;
type CollationRenderer = (order: OrderByNode) => string | undefined;
type TermRenderer = (term: OrderByNode['term']) => string;

/**
 * Compiler for ORDER BY clauses in SELECT statements.
 * Handles compilation of sorting expressions with direction (ASC/DESC).
 */
export class OrderByCompiler {
  /**
   * Compiles ORDER BY clause from a SELECT query AST.
   * @param ast - The SELECT query AST containing sort specifications.
   * @param renderTerm - Function to render an ordering term.
   * @param renderNulls - Optional function to render NULLS FIRST/LAST.
   * @param renderCollation - Optional function to render COLLATE clause.
   * @returns SQL ORDER BY clause (e.g., " ORDER BY table.col1 ASC, table.col2 DESC") or empty string if no ordering.
   */
  static compileOrderBy(
    ast: SelectQueryNode,
    renderTerm: TermRenderer,
    renderNulls?: NullsRenderer,
    renderCollation?: CollationRenderer
  ): string {
    if (!ast.orderBy || ast.orderBy.length === 0) return '';
    const parts = ast.orderBy.map(o => {
      const term = renderTerm(o.term);
      const collation = renderCollation ? renderCollation(o) : o.collation ? ` COLLATE ${o.collation}` : '';
      const nulls = renderNulls ? renderNulls(o) : o.nulls ? ` NULLS ${o.nulls}` : '';
      return `${term} ${o.direction}${collation}${nulls}`;
    }).join(', ');
    return ` ORDER BY ${parts}`;
  }
}
