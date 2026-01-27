import { JoinNode } from './join.js';
import { ExpressionNode } from './expression.js';
import { JoinKind } from '../sql/sql.js';
import { JoinMetadata } from './join-metadata.js';
import { TableSourceNode, TableNode } from './query.js';

/**
 * Creates a JoinNode ready for AST insertion.
 * Centralizing this avoids copy/pasted object literals when multiple services need to synthesize joins.
 */
export const createJoinNode = (
  kind: JoinKind,
  tableName: string | TableSourceNode,
  condition?: ExpressionNode,
  relationName?: string
): JoinNode => ({
  type: 'Join',
  kind,
  table: typeof tableName === 'string'
    ? (parseQualifiedTableRef(tableName) as TableNode)
    : (tableName as TableSourceNode),
  condition,
  meta: relationName ? ({ relationName } as JoinMetadata) : undefined
});

/**
 * Parses a simple qualified reference like `schema.table` into a structured TableNode.
 *
 * Notes:
 * - We intentionally only support a single dot here.
 * - For multi-part qualification (server/db/schema/table), callers should pass a TableNode.
 */
const parseQualifiedTableRef = (ref: string): TableNode => {
  const parts = ref.split('.');
  if (parts.length === 2) {
    const [schema, name] = parts;
    return { type: 'Table', schema, name };
  }
  return { type: 'Table', name: ref };
};
