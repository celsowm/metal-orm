import { CompilerContext, Dialect } from '../abstract.js';
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
    dialect: Dialect,
    compileFrom: (from: TableSourceNode, ctx: CompilerContext) => string,
    compileExpression: (expr: ExpressionNode, ctx: CompilerContext) => string
  ): string {
    if (!joins || joins.length === 0) return '';
    const parts = joins.map(j => {
      if (!dialect.supportsJoinKind(j.kind)) {
        throw new Error(`Join kind ${j.kind} is not supported by this dialect.`);
      }

      const table = compileFrom(j.table, ctx);

      if (j.kind === 'CROSS') {
        return `CROSS JOIN ${table}`;
      }

      if (!j.condition) {
        throw new Error(`Join kind ${j.kind} requires a condition.`);
      }

      const cond = compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    });
    return ` ${parts.join(' ')}`;
  }
}
