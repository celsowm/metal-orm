import { JoinNode } from './join.js';

/**
 * Metadata stored on JoinNode.meta for higher-level concerns.
 */
export interface JoinMetadata {
  relationName?: string;
}

/**
 * Retrieves the relation name from join metadata if present.
 */
export const getJoinRelationName = (join: JoinNode): string | undefined =>
  (join.meta as JoinMetadata | undefined)?.relationName;
