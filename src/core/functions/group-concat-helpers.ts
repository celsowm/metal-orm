import type { FunctionRenderContext } from './types.js';
import { isOperandNode, type LiteralNode, type OperandNode } from '../ast/expression.js';

/** Default separator used when GROUP_CONCAT has no explicit separator. */
export const DEFAULT_GROUP_CONCAT_SEPARATOR: LiteralNode = {
  type: 'Literal',
  value: ','
};

/**
 * Builds an ORDER BY clause for functions that support ordering (e.g. GROUP_CONCAT).
 */
export function buildGroupConcatOrderBy(ctx: FunctionRenderContext): string {
  const orderBy = ctx.node.orderBy;
  if (!orderBy || orderBy.length === 0) {
    return '';
  }
  const parts = orderBy.map(order => {
    const term = isOperandNode(order.term)
      ? ctx.compileOperand(order.term)
      : (() => {
          throw new Error('ORDER BY expressions inside functions must be operands');
        })();
    const collation = order.collation ? ` COLLATE ${order.collation}` : '';
    const nulls = order.nulls ? ` NULLS ${order.nulls}` : '';
    return `${term} ${order.direction}${collation}${nulls}`;
  });
  return `ORDER BY ${parts.join(', ')}`;
}

/**
 * Formats the SEPARATOR clause for GROUP_CONCAT.
 */
export function formatGroupConcatSeparator(ctx: FunctionRenderContext): string {
  if (!ctx.node.separator) {
    return '';
  }
  return ` SEPARATOR ${ctx.compileOperand(ctx.node.separator)}`;
}

/**
 * Returns the operand used as the separator for GROUP_CONCAT.
 */
export function getGroupConcatSeparatorOperand(ctx: FunctionRenderContext): OperandNode {
  return ctx.node.separator ?? DEFAULT_GROUP_CONCAT_SEPARATOR;
}

/**
 * Renders the default GROUP_CONCAT statement.
 */
export function renderStandardGroupConcat(ctx: FunctionRenderContext): string {
  const arg = ctx.compiledArgs[0];
  const orderClause = buildGroupConcatOrderBy(ctx);
  const orderSegment = orderClause ? ` ${orderClause}` : '';
  const separatorClause = formatGroupConcatSeparator(ctx);
  return `GROUP_CONCAT(${arg}${orderSegment}${separatorClause})`;
}
