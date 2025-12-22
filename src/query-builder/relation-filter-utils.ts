import { ExpressionNode, OperandNode, isOperandNode } from '../core/ast/expression.js';
import { OrderingTerm } from '../core/ast/query.js';

type FilterTableCollector = {
  tables: Set<string>;
  hasSubquery: boolean;
};

export type SplitFilterExpressionsResult = {
  selfFilters: ExpressionNode[];
  crossFilters: ExpressionNode[];
};

export const splitFilterExpressions = (
  filter: ExpressionNode | undefined,
  allowedTables: Set<string>
): SplitFilterExpressionsResult => {
  const terms = flattenAnd(filter);
  const selfFilters: ExpressionNode[] = [];
  const crossFilters: ExpressionNode[] = [];

  for (const term of terms) {
    if (isExpressionSelfContained(term, allowedTables)) {
      selfFilters.push(term);
    } else {
      crossFilters.push(term);
    }
  }

  return { selfFilters, crossFilters };
};

const flattenAnd = (node?: ExpressionNode): ExpressionNode[] => {
  if (!node) return [];
  if (node.type === 'LogicalExpression' && node.operator === 'AND') {
    return node.operands.flatMap(operand => flattenAnd(operand));
  }
  return [node];
};

const isExpressionSelfContained = (expr: ExpressionNode, allowedTables: Set<string>): boolean => {
  const collector = collectReferencedTables(expr);
  if (collector.hasSubquery) return false;
  if (collector.tables.size === 0) return true;
  for (const table of collector.tables) {
    if (!allowedTables.has(table)) {
      return false;
    }
  }
  return true;
};

const collectReferencedTables = (expr: ExpressionNode): FilterTableCollector => {
  const collector: FilterTableCollector = {
    tables: new Set(),
    hasSubquery: false
  };
  collectFromExpression(expr, collector);
  return collector;
};

const collectFromExpression = (expr: ExpressionNode, collector: FilterTableCollector): void => {
  switch (expr.type) {
    case 'BinaryExpression':
      collectFromOperand(expr.left, collector);
      collectFromOperand(expr.right, collector);
      break;
    case 'LogicalExpression':
      expr.operands.forEach(operand => collectFromExpression(operand, collector));
      break;
    case 'NullExpression':
      collectFromOperand(expr.left, collector);
      break;
    case 'InExpression':
      collectFromOperand(expr.left, collector);
      if (Array.isArray(expr.right)) {
        expr.right.forEach(value => collectFromOperand(value, collector));
      } else {
        collector.hasSubquery = true;
      }
      break;
    case 'ExistsExpression':
      collector.hasSubquery = true;
      break;
    case 'BetweenExpression':
      collectFromOperand(expr.left, collector);
      collectFromOperand(expr.lower, collector);
      collectFromOperand(expr.upper, collector);
      break;
    case 'ArithmeticExpression':
    case 'BitwiseExpression':
      collectFromOperand(expr.left, collector);
      collectFromOperand(expr.right, collector);
      break;
    default:
      break;
  }
};

const collectFromOperand = (node: OperandNode, collector: FilterTableCollector): void => {
  switch (node.type) {
    case 'Column':
      collector.tables.add(node.table);
      break;
    case 'Function':
      node.args.forEach(arg => collectFromOperand(arg, collector));
      if (node.separator) {
        collectFromOperand(node.separator, collector);
      }
      if (node.orderBy) {
        node.orderBy.forEach(order => collectFromOrderingTerm(order.term, collector));
      }
      break;
    case 'JsonPath':
      collectFromOperand(node.column, collector);
      break;
    case 'ScalarSubquery':
      collector.hasSubquery = true;
      break;
    case 'CaseExpression':
      node.conditions.forEach(({ when, then }) => {
        collectFromExpression(when, collector);
        collectFromOperand(then, collector);
      });
      if (node.else) {
        collectFromOperand(node.else, collector);
      }
      break;
    case 'Cast':
      collectFromOperand(node.expression, collector);
      break;
    case 'WindowFunction':
      node.args.forEach(arg => collectFromOperand(arg, collector));
      node.partitionBy?.forEach(part => collectFromOperand(part, collector));
      node.orderBy?.forEach(order => collectFromOrderingTerm(order.term, collector));
      break;
    case 'Collate':
      collectFromOperand(node.expression, collector);
      break;
    case 'ArithmeticExpression':
    case 'BitwiseExpression':
      collectFromOperand(node.left, collector);
      collectFromOperand(node.right, collector);
      break;
    case 'Literal':
    case 'AliasRef':
      break;
    default:
      break;
  }
};

const collectFromOrderingTerm = (term: OrderingTerm, collector: FilterTableCollector): void => {
  if (isOperandNode(term)) {
    collectFromOperand(term, collector);
    return;
  }
  collectFromExpression(term, collector);
};
