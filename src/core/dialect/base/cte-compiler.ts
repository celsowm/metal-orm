import { SelectQueryNode } from '../../ast/query.js';
import { CompilerContext } from '../abstract.js';

/**
 * Compiler for Common Table Expressions (CTEs).
 * Handles compilation of WITH and WITH RECURSIVE clauses.
 */
export class CteCompiler {
  /**
   * Compiles CTEs (WITH clauses) including recursive CTEs.
   * @param ast - The SELECT query AST containing CTE definitions.
   * @param ctx - The compiler context for expression compilation.
   * @param quoteIdentifier - Function to quote identifiers according to dialect rules.
   * @param compileSelectAst - Function to recursively compile SELECT query ASTs.
   * @param normalizeSelectAst - Function to normalize SELECT query ASTs before compilation.
   * @param stripTrailingSemicolon - Function to remove trailing semicolons from SQL.
   * @returns SQL WITH clause string (e.g., "WITH cte_name AS (...) ") or empty string if no CTEs.
   */
  static compileCtes(ast: SelectQueryNode, ctx: CompilerContext, quoteIdentifier: (id: string) => string, compileSelectAst: (ast: SelectQueryNode, ctx: CompilerContext) => string, normalizeSelectAst: (ast: SelectQueryNode) => SelectQueryNode, stripTrailingSemicolon: (sql: string) => string): string {
    if (!ast.ctes || ast.ctes.length === 0) return '';
    const hasRecursive = ast.ctes.some(cte => cte.recursive);
    const prefix = hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
    const cteDefs = ast.ctes.map(cte => {
      const name = quoteIdentifier(cte.name);
      const cols = cte.columns && cte.columns.length
        ? `(${cte.columns.map(c => quoteIdentifier(c)).join(', ')})`
        : '';
      const query = stripTrailingSemicolon(compileSelectAst(normalizeSelectAst(cte.query), ctx));
      return `${name}${cols} AS (${query})`;
    }).join(', ');
    return `${prefix}${cteDefs} `;
  }
}
