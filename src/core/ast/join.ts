import { TableNode } from './query';
import { ExpressionNode } from './expression';
import { JoinKind } from '../sql/sql';

/**
 * AST node representing a JOIN clause
 */
export interface JoinNode {
  type: 'Join';
  /** Type of join (INNER, LEFT, RIGHT, etc.) */
  kind: JoinKind;
  /** Table to join */
  table: TableNode;
  /** Join condition expression */
  condition: ExpressionNode;
  /** Optional relation name for code generation */
  relationName?: string;
}
