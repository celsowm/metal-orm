import { JOIN_KINDS } from '../constants/sql';

/**
 * Join kinds allowed when including a relation using `.include(...)`.
 */
export type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;
