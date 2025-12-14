import { CompilerContext } from '../abstract.js';
import { JoinNode } from '../../ast/join.js';
import { TableSourceNode } from '../../ast/query.js';
import { ExpressionNode } from '../../ast/expression.js';

/**
 * Compiler for JOIN clauses in SELECT statements.
 * Handles compilation of all join types (INNER, LEFT, RIGHT, FULL, CROSS).
 */
export class JoinCompiler {
  static compileJoins(
    joins: JoinNode[] | undefined,
    ctx: CompilerContext,
    compileFrom: (from: TableSourceNode, ctx: CompilerContext) => string,
    compileExpression: (expr: ExpressionNode, ctx: CompilerContext) => string
  ): string {
    if (!joins || joins.length === 0) return '';
    const parts = joins.map(j => {
      const table = compileFrom(j.table, ctx);
      const cond = compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    });
    return ` ${parts.join(' ')}`;
  }
}
