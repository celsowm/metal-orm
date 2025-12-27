/**
 * Expression AST nodes and builders.
 * Re-exports components for building and visiting SQL expression trees.
 */
import type { CaseExpressionNode, FunctionNode, WindowFunctionNode } from './expression-nodes.js';

export * from './expression-nodes.js';
export * from './expression-builders.js';
export * from './window-functions.js';
export * from './aggregate-functions.js';
export * from './expression-visitor.js';
export type { ColumnRef, TableRef as AstTableRef } from './types.js';
export * from './adapters.js';

export type TypedExpression<T> =
  (FunctionNode | CaseExpressionNode | WindowFunctionNode) & { __tsType: T };

export const asType = <T>(
  expr: FunctionNode | CaseExpressionNode | WindowFunctionNode
): TypedExpression<T> => expr as TypedExpression<T>;
