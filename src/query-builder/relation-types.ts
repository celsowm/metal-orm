import { ExpressionNode } from '../core/ast/expression.js';
import { JOIN_KINDS } from '../core/sql/sql.js';

/**
 * Join kinds allowed when including a relation using `.include(...)`.
 */
export type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;

/**
 * Options for including a relation in a query
 */
export interface RelationIncludeOptions {
  columns?: readonly string[];
  aliasPrefix?: string;
  filter?: ExpressionNode;
  joinKind?: RelationIncludeJoinKind;
  pivot?: {
    columns?: string[];
    aliasPrefix?: string;
  };
}
