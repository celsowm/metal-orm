import type { JoinNode } from '../core/ast/join.js';
import { getJoinRelationName } from '../core/ast/join-metadata.js';

export const findJoinIndexByRelationKey = (joins: JoinNode[], relationKey: string): number =>
  joins.findIndex(j => getJoinRelationName(j) === relationKey);

export const findJoinByRelationKey = (
  joins: JoinNode[],
  relationKey: string
): JoinNode | undefined =>
  joins.find(j => getJoinRelationName(j) === relationKey);

export const hasJoinForRelationKey = (joins: JoinNode[], relationKey: string): boolean =>
  findJoinIndexByRelationKey(joins, relationKey) !== -1;
