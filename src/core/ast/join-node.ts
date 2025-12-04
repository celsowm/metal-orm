import { JoinNode } from './join.js';
import { ExpressionNode } from './expression.js';
import { JoinKind } from '../sql/sql.js';

/**
 * Creates a JoinNode ready for AST insertion.
 * Centralizing this avoids copy/pasted object literals when multiple services need to synthesize joins.
 */
export const createJoinNode = (
  kind: JoinKind,
  tableName: string,
  condition: ExpressionNode,
  relationName?: string
): JoinNode => ({
  type: 'Join',
  kind,
  table: { type: 'Table', name: tableName },
  condition,
  relationName
});
