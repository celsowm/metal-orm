import type { SelectQueryNode } from './query.js';
import { visitSelectQuery } from './query-visitor.js';

export const hasParamOperandsInQuery = (ast: SelectQueryNode): boolean => {
  let hasParams = false;

  visitSelectQuery(ast, {
    visitParam: () => {
      hasParams = true;
    }
  });

  return hasParams;
};
