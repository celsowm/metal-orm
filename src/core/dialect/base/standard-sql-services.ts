import type { CompilerContext } from '../abstract.js';
import type {
  SelectQueryNode,
  InsertQueryNode,
  OrderByNode,
  OrderingTerm,
  TableNode
} from '../../ast/query.js';
import type {
  ColumnNode,
  ExpressionNode,
  OperandNode
} from '../../ast/expression.js';
import type { PaginationStrategy } from './pagination-strategy.js';
import type { TableFunctionStrategy } from '../../functions/table-types.js';

/**
 * Narrow callback surface consumed by the standard SQL compilers.
 * It deliberately depends on no dialect superclass or built-in dialect union.
 */
export interface StandardSqlCompilerServices {
  getDialectName(): string;
  getPaginationStrategy(): PaginationStrategy;
  getTableFunctionStrategy(): TableFunctionStrategy;

  quoteIdentifier(id: string): string;
  compileOperand(node: OperandNode, ctx: CompilerContext): string;
  compileExpression(node: ExpressionNode, ctx: CompilerContext): string;
  compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string;

  normalizeSelectAst(ast: SelectQueryNode): SelectQueryNode;
  compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;

  compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string;
  compileUpsertClause(ast: InsertQueryNode, ctx: CompilerContext): string;
  compileSetTarget(column: ColumnNode, table: TableNode): string;

  renderOrderByNulls(order: OrderByNode): string | undefined;
  renderOrderByCollation(order: OrderByNode): string | undefined;
}
