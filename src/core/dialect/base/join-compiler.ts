import { SelectQueryNode } from '../../ast/query.js';
import { CompilerContext } from '../abstract.js';

/**
 * Compiler for JOIN clauses in SELECT statements.
 * Handles compilation of all join types (INNER, LEFT, RIGHT, FULL, CROSS).
 */
export class JoinCompiler {
  /**
   * Compiles all JOIN clauses from a SELECT query AST.
   * @param ast - The SELECT query AST containing join definitions.
   * @param ctx - The compiler context for expression compilation.
   * @param compileFrom - Function to compile table sources (tables or subqueries).
   * @param compileExpression - Function to compile join condition expressions.
   * @returns SQL JOIN clauses (e.g., " LEFT JOIN table ON condition") or empty string if no joins.
   */
  static compileJoins(ast: SelectQueryNode, ctx: CompilerContext, compileFrom: (from: any, ctx: CompilerContext) => string, compileExpression: (expr: any, ctx: CompilerContext) => string): string {
    if (!ast.joins || ast.joins.length === 0) return '';
    const parts = ast.joins.map(j => {
      const table = compileFrom(j.table as any, ctx);
      const cond = compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    });
    return ` ${parts.join(' ')}`;
  }
}
