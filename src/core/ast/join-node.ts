import { JoinNode } from './join.js';
import { ExpressionNode } from './expression.js';
import { JoinKind } from '../sql/sql.js';
import { JoinMetadata } from './join-metadata.js';
import { TableNode, FunctionTableNode } from './query.js';

/**
 * Creates a JoinNode ready for AST insertion.
 * Centralizing this avoids copy/pasted object literals when multiple services need to synthesize joins.
 */
export const createJoinNode = (
  kind: JoinKind,
  tableName: string | TableNode | FunctionTableNode,
  condition: ExpressionNode,
  relationName?: string
): JoinNode => ({
  type: 'Join',
  kind,
  table: typeof tableName === 'string' ? { type: 'Table', name: tableName } as TableNode : (tableName as TableNode | FunctionTableNode),
  condition,
  meta: relationName ? ({ relationName } as JoinMetadata) : undefined
});
