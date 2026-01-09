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
import {
  hasOperandDispatcher,
  type ExpressionVisitor,
  type OperandVisitor,
  visitExpression,
  visitOperand
} from './expression-visitor.js';

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

export const visitSelectQuery = (ast: SelectQueryNode, visitor: SelectQueryVisitor): void => {
  const visitExpressionNode = (node: ExpressionNode): void => {
    visitExpression(node, expressionVisitor);
  };

  const visitOperandNode = (node: OperandNode): void => {
    visitOperand(node, operandVisitor);
  };

  const visitOrderingTerm = (term: OrderingTerm): void => {
    if (!term || typeof term !== 'object') return;
    if (isOperandNode(term)) {
      visitOperandNode(term);
      return;
    }
    const type = getNodeType(term);
    if (type && hasOperandDispatcher(type)) {
      visitOperandNode(term as unknown as OperandNode);
      return;
    }
    if (type) {
      visitExpressionNode(term as ExpressionNode);
    }
  };

  const visitOrderByNode = (node: OrderByNode): void => {
    visitor.visitOrderBy?.(node);
    visitOrderingTerm(node.term);
  };

  const visitTableSource = (source: TableSourceNode): void => {
    visitor.visitTableSource?.(source);
    if (source.type === 'DerivedTable') {
      visitor.visitDerivedTable?.(source);
      visitSelectQuery(source.query, visitor);
      return;
    }
    if (source.type === 'FunctionTable') {
      visitor.visitFunctionTable?.(source);
      source.args?.forEach(arg => visitOperandNode(arg));
    }
  };

  const expressionVisitor: ExpressionVisitor<void> = {
    visitBinaryExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.right);
      if (node.escape) {
        visitOperandNode(node.escape);
      }
    },
    visitLogicalExpression: (node) => {
      visitor.visitExpression?.(node);
      node.operands.forEach(operand => visitExpressionNode(operand));
    },
    visitNullExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
    },
    visitInExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
      if (Array.isArray(node.right)) {
        node.right.forEach(operand => visitOperandNode(operand));
      } else {
        visitOperandNode(node.right);
      }
    },
    visitExistsExpression: (node) => {
      visitor.visitExpression?.(node);
      visitSelectQuery(node.subquery, visitor);
    },
    visitBetweenExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.lower);
      visitOperandNode(node.upper);
    },
    visitArithmeticExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.right);
    },
    visitBitwiseExpression: (node) => {
      visitor.visitExpression?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.right);
    },
    visitOperand: (node) => {
      visitOperandNode(node);
    },
    visitSelectQuery: (node) => {
      visitSelectQuery(node, visitor);
    },
    otherwise: (node) => {
      visitor.visitExpression?.(node);
    }
  };

  const operandVisitor: OperandVisitor<void> = {
    visitColumn: (node) => {
      visitor.visitOperand?.(node);
    },
    visitLiteral: (node) => {
      visitor.visitOperand?.(node);
    },
    visitParam: (node) => {
      visitor.visitOperand?.(node);
      visitor.visitParam?.(node);
    },
    visitFunction: (node) => {
      visitor.visitOperand?.(node);
      node.args?.forEach(arg => visitOperandNode(arg));
      node.orderBy?.forEach(order => visitOrderByNode(order));
      if (node.separator) {
        visitOperandNode(node.separator);
      }
    },
    visitJsonPath: (node) => {
      visitor.visitOperand?.(node);
      visitOperandNode(node.column);
    },
    visitScalarSubquery: (node) => {
      visitor.visitOperand?.(node);
      visitSelectQuery(node.query, visitor);
    },
    visitCaseExpression: (node) => {
      visitor.visitOperand?.(node);
      node.conditions.forEach(cond => {
        visitExpressionNode(cond.when);
        visitOperandNode(cond.then);
      });
      if (node.else) {
        visitOperandNode(node.else);
      }
    },
    visitCast: (node) => {
      visitor.visitOperand?.(node);
      visitOperandNode(node.expression);
    },
    visitWindowFunction: (node) => {
      visitor.visitOperand?.(node);
      node.args?.forEach(arg => visitOperandNode(arg));
      node.partitionBy?.forEach(term => visitOperandNode(term));
      node.orderBy?.forEach(order => visitOrderByNode(order));
    },
    visitArithmeticExpression: (node) => {
      visitor.visitOperand?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.right);
    },
    visitBitwiseExpression: (node) => {
      visitor.visitOperand?.(node);
      visitOperandNode(node.left);
      visitOperandNode(node.right);
    },
    visitExpression: (node) => {
      visitExpressionNode(node);
    },
    visitSelectQuery: (node) => {
      visitSelectQuery(node, visitor);
    },
    visitCollate: (node) => {
      visitor.visitOperand?.(node);
      visitOperandNode(node.expression);
    },
    visitAliasRef: (node) => {
      visitor.visitOperand?.(node);
    },
    otherwise: (node) => {
      visitor.visitOperand?.(node);
    }
  };

  visitor.visitSelectQuery?.(ast);

  if (ast.ctes) {
    for (const cte of ast.ctes) {
      visitor.visitCte?.(cte);
      visitSelectQuery(cte.query, visitor);
    }
  }

  visitTableSource(ast.from);

  ast.columns?.forEach(col => {
    visitOperandNode(col as OperandNode);
  });

  ast.joins?.forEach(join => {
    visitor.visitJoin?.(join);
    visitTableSource(join.table);
    visitExpressionNode(join.condition);
  });

  if (ast.where) {
    visitExpressionNode(ast.where);
  }

  ast.groupBy?.forEach(term => {
    visitOrderingTerm(term);
  });

  if (ast.having) {
    visitExpressionNode(ast.having);
  }

  ast.orderBy?.forEach(order => {
    visitOrderByNode(order);
  });

  ast.distinct?.forEach(col => {
    visitOperandNode(col);
  });

  ast.setOps?.forEach(op => {
    visitor.visitSetOperation?.(op);
    visitSelectQuery(op.query, visitor);
  });
};
