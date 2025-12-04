import { ExpressionNode } from '../core/ast/expression';
import { JOIN_KINDS } from '../core/sql/sql';

/**
 * Join kinds allowed when including a relation using `.include(...)`.
 */
export type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;

/**
 * Options for including a relation in a query
 */
export interface RelationIncludeOptions {
  columns?: string[];
  aliasPrefix?: string;
  filter?: ExpressionNode;
  joinKind?: RelationIncludeJoinKind;
  pivot?: {
    columns?: string[];
    aliasPrefix?: string;
  };
}
