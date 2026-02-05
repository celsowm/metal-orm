import {
  CaseExpressionNode,
  CastExpressionNode,
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  JsonPathNode,
  OperandNode,
  ScalarSubqueryNode,
  WindowFunctionNode,
  isOperandNode
} from '../core/ast/expression.js';
import type { OrderingTerm, SelectQueryNode } from '../core/ast/query.js';

export const remapExpressionTable = (
  expr: ExpressionNode | undefined,
  fromTable: string,
  toTable: string
): ExpressionNode | undefined => {
  if (!expr || fromTable === toTable) return expr;
  return mapExpression(expr, fromTable, toTable);
};

const mapExpression = (expr: ExpressionNode, fromTable: string, toTable: string): ExpressionNode => {
  switch (expr.type) {
    case 'BinaryExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'LogicalExpression': {
      const nextOperands = expr.operands.map(op => mapExpression(op, fromTable, toTable));
      if (nextOperands.every((op, i) => op === expr.operands[i])) return expr;
      return { ...expr, operands: nextOperands };
    }
    case 'NullExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      if (left === expr.left) return expr;
      return { ...expr, left };
    }
    case 'InExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      let right = expr.right;
      if (Array.isArray(expr.right)) {
        const mapped = expr.right.map(val => mapOperand(val, fromTable, toTable));
        if (!mapped.every((val, i) => val === expr.right[i])) {
          right = mapped;
        }
      } else if (expr.right.type === 'ScalarSubquery') {
        const mapped = mapScalarSubquery(expr.right, fromTable, toTable);
        if (mapped !== expr.right) right = mapped;
      }
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'ExistsExpression': {
      const mapped = mapSelectQuery(expr.subquery, fromTable, toTable);
      if (mapped === expr.subquery) return expr;
      return { ...expr, subquery: mapped };
    }
    case 'BetweenExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const lower = mapOperand(expr.lower, fromTable, toTable);
      const upper = mapOperand(expr.upper, fromTable, toTable);
      if (left === expr.left && lower === expr.lower && upper === expr.upper) return expr;
      return { ...expr, left, lower, upper };
    }
    case 'ArithmeticExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'BitwiseExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    default:
      return expr;
  }
};

const mapColumn = (node: ColumnNode, fromTable: string, toTable: string): ColumnNode => {
  if (node.table !== fromTable) return node;
  return { ...node, table: toTable };
};

const mapJsonPath = (node: JsonPathNode, fromTable: string, toTable: string): JsonPathNode => {
  const nextColumn = mapColumn(node.column, fromTable, toTable);
  if (nextColumn === node.column) return node;
  return { ...node, column: nextColumn };
};

const mapWindowFunctionArg = (
  node: WindowFunctionNode['args'][number],
  fromTable: string,
  toTable: string
): WindowFunctionNode['args'][number] => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'JsonPath':
      return mapJsonPath(node, fromTable, toTable);
    default:
      return node;
  }
};

const mapOperand = (node: OperandNode, fromTable: string, toTable: string): OperandNode => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'Function': {
      const nextArgs = node.args.map(arg => mapOperand(arg, fromTable, toTable));
      const nextSeparator = node.separator ? mapOperand(node.separator, fromTable, toTable) : node.separator;
      const nextOrderBy = node.orderBy?.map(order => ({
        ...order,
        term: mapOrderingTerm(order.term, fromTable, toTable)
      }));
      const changed = nextArgs.some((arg, i) => arg !== node.args[i]) ||
        nextSeparator !== node.separator ||
        (nextOrderBy && node.orderBy && nextOrderBy.some((ob, i) => ob.term !== node.orderBy![i].term));
      if (!changed) return node;
      return {
        ...node,
        args: nextArgs,
        separator: nextSeparator,
        orderBy: nextOrderBy
      };
    }
    case 'JsonPath': {
      return mapJsonPath(node, fromTable, toTable);
    }
    case 'ScalarSubquery': {
      return mapScalarSubquery(node, fromTable, toTable);
    }
    case 'CaseExpression': {
      const nextConditions = node.conditions.map(cond => ({
        when: mapExpression(cond.when, fromTable, toTable),
        then: mapOperand(cond.then, fromTable, toTable)
      }));
      const nextElse = node.else ? mapOperand(node.else, fromTable, toTable) : node.else;
      const changed =
        nextConditions.some((cond, i) =>
          cond.when !== node.conditions[i].when || cond.then !== node.conditions[i].then
        ) ||
        nextElse !== node.else;
      if (!changed) return node;
      return { ...node, conditions: nextConditions, else: nextElse };
    }
    case 'Cast': {
      const nextExpr = mapOperand(node.expression, fromTable, toTable);
      if (nextExpr === node.expression) return node;
      return { ...node, expression: nextExpr };
    }
    case 'WindowFunction': {
      const nextArgs = node.args.map(arg => mapWindowFunctionArg(arg, fromTable, toTable));
      const nextPartition = node.partitionBy?.map(part => mapColumn(part, fromTable, toTable));
      const nextOrderBy = node.orderBy?.map(order => ({
        ...order,
        term: mapOrderingTerm(order.term, fromTable, toTable)
      }));
      const changed =
        nextArgs.some((arg, i) => arg !== node.args[i]) ||
        (nextPartition && node.partitionBy && nextPartition.some((p, i) => p !== node.partitionBy![i])) ||
        (nextOrderBy && node.orderBy && nextOrderBy.some((ob, i) => ob.term !== node.orderBy![i].term));
      if (!changed) return node;
      return {
        ...node,
        args: nextArgs,
        partitionBy: nextPartition,
        orderBy: nextOrderBy
      };
    }
    case 'Collate': {
      const nextExpr = mapOperand(node.expression, fromTable, toTable);
      if (nextExpr === node.expression) return node;
      return { ...node, expression: nextExpr };
    }
    case 'ArithmeticExpression': {
      const left = mapOperand(node.left, fromTable, toTable);
      const right = mapOperand(node.right, fromTable, toTable);
      if (left === node.left && right === node.right) return node;
      return { ...node, left, right };
    }
    case 'BitwiseExpression': {
      const left = mapOperand(node.left, fromTable, toTable);
      const right = mapOperand(node.right, fromTable, toTable);
      if (left === node.left && right === node.right) return node;
      return { ...node, left, right };
    }
    default:
      return node;
  }
};

const mapOrderingTerm = (term: OrderingTerm, fromTable: string, toTable: string): OrderingTerm => {
  if (isOperandNode(term)) {
    return mapOperand(term, fromTable, toTable);
  }
  return mapExpression(term as ExpressionNode, fromTable, toTable);
};

const mapScalarSubquery = (
  node: ScalarSubqueryNode,
  fromTable: string,
  toTable: string
): ScalarSubqueryNode => {
  const mapped = mapSelectQuery(node.query, fromTable, toTable);
  if (mapped === node.query) return node;
  return { ...node, query: mapped };
};

type ProjectionNode = SelectQueryNode['columns'][number];

const mapProjectionNode = (
  node: ProjectionNode,
  fromTable: string,
  toTable: string
): ProjectionNode => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'Function':
      return mapOperand(node, fromTable, toTable) as FunctionNode;
    case 'CaseExpression':
      return mapOperand(node, fromTable, toTable) as CaseExpressionNode;
    case 'Cast':
      return mapOperand(node, fromTable, toTable) as CastExpressionNode;
    case 'WindowFunction':
      return mapOperand(node, fromTable, toTable) as WindowFunctionNode;
    case 'ScalarSubquery':
      return mapScalarSubquery(node, fromTable, toTable);
    default:
      return node;
  }
};

const mapSelectQuery = (query: SelectQueryNode, fromTable: string, toTable: string): SelectQueryNode => {
  const nextColumns = query.columns.map(col => mapProjectionNode(col, fromTable, toTable));
  const nextJoins = query.joins.map(join => ({
    ...join,
    condition: mapExpression(join.condition, fromTable, toTable)
  }));
  const nextWhere = query.where ? mapExpression(query.where, fromTable, toTable) : query.where;
  const nextHaving = query.having ? mapExpression(query.having, fromTable, toTable) : query.having;
  const nextGroupBy = query.groupBy?.map(term => mapOrderingTerm(term, fromTable, toTable));
  const nextOrderBy = query.orderBy?.map(ob => ({
    ...ob,
    term: mapOrderingTerm(ob.term, fromTable, toTable)
  }));
  const nextDistinct = query.distinct?.map(col => mapColumn(col, fromTable, toTable));
  const nextSetOps = query.setOps?.map(op => ({ ...op, query: mapSelectQuery(op.query, fromTable, toTable) }));
  const nextCtes = query.ctes?.map(cte => ({ ...cte, query: mapSelectQuery(cte.query, fromTable, toTable) }));

  const changed =
    nextColumns.some((c, i) => c !== query.columns[i]) ||
    nextJoins.some((j, i) => j.condition !== query.joins[i].condition) ||
    nextWhere !== query.where ||
    nextHaving !== query.having ||
    (nextGroupBy && query.groupBy && nextGroupBy.some((t, i) => t !== query.groupBy![i])) ||
    (nextOrderBy && query.orderBy && nextOrderBy.some((o, i) => o.term !== query.orderBy![i].term)) ||
    (nextDistinct && query.distinct && nextDistinct.some((d, i) => d !== query.distinct![i])) ||
    (nextSetOps && query.setOps && nextSetOps.some((o, i) => o.query !== query.setOps![i].query)) ||
    (nextCtes && query.ctes && nextCtes.some((c, i) => c.query !== query.ctes![i].query));

  if (!changed) return query;

  return {
    ...query,
    columns: nextColumns,
    joins: nextJoins,
    where: nextWhere,
    having: nextHaving,
    groupBy: nextGroupBy,
    orderBy: nextOrderBy,
    distinct: nextDistinct,
    setOps: nextSetOps,
    ctes: nextCtes
  };
};
