import { TableSourceNode } from './query.js';
import { ExpressionNode } from './expression.js';
import { JoinKind } from '../sql/sql.js';

/**
 * AST node representing a JOIN clause
 */
export interface JoinNode {
  type: 'Join';
  /** Type of join (INNER, LEFT, RIGHT, etc.) */
  kind: JoinKind;
  /** Table to join */
  table: TableSourceNode;
 /** Join condition expression */
  condition: ExpressionNode;
  /** Optional metadata for non-SQL concerns (e.g., relation name) */
  meta?: Record<string, unknown>;
}
