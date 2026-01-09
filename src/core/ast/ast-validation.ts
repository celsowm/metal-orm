import type { SelectQueryNode } from './query.js';
import { visitSelectQuery } from './query-visitor.js';

export const findFirstParamOperandName = (ast: SelectQueryNode): string | undefined => {
  let name: string | undefined;

  visitSelectQuery(ast, {
    visitParam: (node) => {
      if (!name) {
        name = node.name;
      }
    }
  });

  return name;
};

export const hasParamOperandsInQuery = (ast: SelectQueryNode): boolean =>
  !!findFirstParamOperandName(ast);
