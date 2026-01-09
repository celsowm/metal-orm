import type {
  CommonTableExpressionNode,
  DerivedTableNode,
  FunctionTableNode,
  OrderByNode,
  OrderingTerm,
  SelectQueryNode,
  SetOperationNode,
  TableSourceNode
} from './query.js';
import type { JoinNode } from './join.js';
import type {
  ExpressionNode,
  OperandNode,
  ParamNode
} from './expression-nodes.js';
import { isOperandNode } from './expression-nodes.js';

export interface SelectQueryVisitor {
  visitSelectQuery?(node: SelectQueryNode): void;
  visitTableSource?(node: TableSourceNode): void;
  visitDerivedTable?(node: DerivedTableNode): void;
  visitFunctionTable?(node: FunctionTableNode): void;
  visitJoin?(node: JoinNode): void;
  visitCte?(node: CommonTableExpressionNode): void;
  visitSetOperation?(node: SetOperationNode): void;
  visitOrderBy?(node: OrderByNode): void;
  visitExpression?(node: ExpressionNode): void;
  visitOperand?(node: OperandNode): void;
  visitParam?(node: ParamNode): void;
}

const getNodeType = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, 'type');
  if (descriptor && typeof descriptor.value === 'string') {
    return descriptor.value;
  }
  if ('type' in value) {
    const type = (value as { type?: unknown }).type;
    return typeof type === 'string' ? type : undefined;
  }
  return undefined;
};

const visitOrderingTerm = (term: OrderingTerm, visitor: SelectQueryVisitor): void => {
  if (isOperandNode(term)) {
    visitOperandNode(term, visitor);
    return;
  }
  visitExpressionNode(term as ExpressionNode, visitor);
};

const visitOrderByNode = (node: OrderByNode, visitor: SelectQueryVisitor): void => {
  visitor.visitOrderBy?.(node);
  visitOrderingTerm(node.term, visitor);
};

const visitTableSource = (source: TableSourceNode, visitor: SelectQueryVisitor): void => {
  visitor.visitTableSource?.(source);
  if (source.type === 'DerivedTable') {
    visitor.visitDerivedTable?.(source);
    visitSelectQuery(source.query, visitor);
    return;
  }
  if (source.type === 'FunctionTable') {
    visitor.visitFunctionTable?.(source);
    source.args?.forEach(arg => visitOperandNode(arg, visitor));
  }
};

const visitExpressionNode = (node: ExpressionNode, visitor: SelectQueryVisitor): void => {
  visitor.visitExpression?.(node);
  const type = getNodeType(node);
  if (!type) return;
  switch (type) {
    case 'BinaryExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.right, visitor);
      if (node.escape) {
        visitOperandNode(node.escape, visitor);
      }
      return;
    case 'LogicalExpression':
      node.operands.forEach(operand => visitExpressionNode(operand, visitor));
      return;
    case 'NullExpression':
      visitOperandNode(node.left, visitor);
      return;
    case 'InExpression':
      visitOperandNode(node.left, visitor);
      if (Array.isArray(node.right)) {
        node.right.forEach(operand => visitOperandNode(operand, visitor));
      } else {
        visitOperandNode(node.right, visitor);
      }
      return;
    case 'ExistsExpression':
      visitSelectQuery(node.subquery, visitor);
      return;
    case 'BetweenExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.lower, visitor);
      visitOperandNode(node.upper, visitor);
      return;
    case 'ArithmeticExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.right, visitor);
      return;
    case 'BitwiseExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.right, visitor);
      return;
    default: {
      return;
    }
  }
};

const visitOperandNode = (node: OperandNode, visitor: SelectQueryVisitor): void => {
  visitor.visitOperand?.(node);
  const type = getNodeType(node);
  if (type === 'Param') {
    visitor.visitParam?.(node);
  }
  if (!type) return;
  switch (type) {
    case 'Column':
    case 'Literal':
    case 'Param':
    case 'AliasRef':
      return;
    case 'Function':
      node.args?.forEach(arg => visitOperandNode(arg, visitor));
      node.orderBy?.forEach(order => visitOrderByNode(order, visitor));
      if (node.separator) {
        visitOperandNode(node.separator, visitor);
      }
      return;
    case 'JsonPath':
      visitOperandNode(node.column, visitor);
      return;
    case 'ScalarSubquery':
      visitSelectQuery(node.query, visitor);
      return;
    case 'CaseExpression':
      node.conditions.forEach(cond => {
        visitExpressionNode(cond.when, visitor);
        visitOperandNode(cond.then, visitor);
      });
      if (node.else) {
        visitOperandNode(node.else, visitor);
      }
      return;
    case 'Cast':
      visitOperandNode(node.expression, visitor);
      return;
    case 'WindowFunction':
      node.args?.forEach(arg => visitOperandNode(arg, visitor));
      node.partitionBy?.forEach(term => visitOperandNode(term, visitor));
      node.orderBy?.forEach(order => visitOrderByNode(order, visitor));
      return;
    case 'ArithmeticExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.right, visitor);
      return;
    case 'BitwiseExpression':
      visitOperandNode(node.left, visitor);
      visitOperandNode(node.right, visitor);
      return;
    case 'Collate':
      visitOperandNode(node.expression, visitor);
      return;
    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
};

export const visitSelectQuery = (ast: SelectQueryNode, visitor: SelectQueryVisitor): void => {
  visitor.visitSelectQuery?.(ast);

  if (ast.ctes) {
    for (const cte of ast.ctes) {
      visitor.visitCte?.(cte);
      visitSelectQuery(cte.query, visitor);
    }
  }

  visitTableSource(ast.from, visitor);

  ast.columns?.forEach(col => {
    visitOperandNode(col as OperandNode, visitor);
  });

  ast.joins?.forEach(join => {
    visitor.visitJoin?.(join);
    visitTableSource(join.table, visitor);
    visitExpressionNode(join.condition, visitor);
  });

  if (ast.where) {
    visitExpressionNode(ast.where, visitor);
  }

  ast.groupBy?.forEach(term => {
    visitOrderingTerm(term, visitor);
  });

  if (ast.having) {
    visitExpressionNode(ast.having, visitor);
  }

  ast.orderBy?.forEach(order => {
    visitOrderByNode(order, visitor);
  });

  ast.distinct?.forEach(col => {
    visitOperandNode(col, visitor);
  });

  ast.setOps?.forEach(op => {
    visitor.visitSetOperation?.(op);
    visitSelectQuery(op.query, visitor);
  });
};
