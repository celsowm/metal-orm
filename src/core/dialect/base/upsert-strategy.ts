import type { CompilerContext } from '../abstract.js';
import type {
  InsertQueryNode,
  TableNode,
  UpdateAssignmentNode
} from '../../ast/query.js';
import type { ExpressionNode, OperandNode } from '../../ast/expression.js';

/** Narrow services needed by backend-specific UPSERT implementations. */
export interface UpsertCompilationServices {
  getDialectName(): string;
  quoteIdentifier(id: string): string;
  compileOperand(node: OperandNode, ctx: CompilerContext): string;
  compileExpression(node: ExpressionNode, ctx: CompilerContext): string;
  compileUpdateAssignments(
    assignments: UpdateAssignmentNode[],
    table: TableNode,
    ctx: CompilerContext
  ): string;
}

/** Backend-specific INSERT conflict/upsert rendering strategy. */
export interface UpsertStrategy {
  compile(
    ast: InsertQueryNode,
    ctx: CompilerContext,
    services: UpsertCompilationServices
  ): string;
}

/** Default strategy for dialects without UPSERT support. */
export class NoUpsertStrategy implements UpsertStrategy {
  compile(
    ast: InsertQueryNode,
    _ctx: CompilerContext,
    services: UpsertCompilationServices
  ): string {
    void _ctx;
    if (!ast.onConflict) return '';
    throw new Error(
      `UPSERT/ON CONFLICT is not supported by dialect "${services.getDialectName()}".`
    );
  }
}
