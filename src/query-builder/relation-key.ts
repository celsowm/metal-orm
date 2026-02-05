import { RELATION_SEPARATOR } from './relation-alias.js';

export const buildRelationKey = (segments: string[]): string =>
  segments.join(RELATION_SEPARATOR);
