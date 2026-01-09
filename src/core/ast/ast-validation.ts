import type { ExpressionNode, OperandNode } from './expression-nodes.js';
import { visitExpression, visitOperand } from './expression-visitor.js';
import type { SelectQueryNode } from './query.js';

const hasParamOperandsInExpression = (expr: ExpressionNode): boolean => {
  let hasParams = false;

  visitExpression(expr, {
    visitBinaryExpression: (node) => {
      visitOperand(node.left, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      visitOperand(node.right, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      if (node.escape) {
        visitOperand(node.escape, {
          visitParam: () => { hasParams = true; },
          otherwise: () => {}
        });
      }
    },
    visitLogicalExpression: (node) => {
      node.operands.forEach(operand => {
        if (hasParamOperandsInExpression(operand)) {
          hasParams = true;
        }
      });
    },
    visitNullExpression: () => {},
    visitInExpression: (node) => {
      visitOperand(node.left, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      if (Array.isArray(node.right)) {
        node.right.forEach(operand => visitOperand(operand, {
          visitParam: () => { hasParams = true; },
          otherwise: () => {}
        }));
      }
    },
    visitExistsExpression: () => {},
    visitBetweenExpression: (node) => {
      visitOperand(node.left, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      visitOperand(node.lower, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      visitOperand(node.upper, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
    },
    visitArithmeticExpression: (node) => {
      visitOperand(node.left, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      visitOperand(node.right, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
    },
    visitBitwiseExpression: (node) => {
      visitOperand(node.left, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
      visitOperand(node.right, {
        visitParam: () => { hasParams = true; },
        otherwise: () => {}
      });
    },
    otherwise: () => {}
  });

  return hasParams;
};

const hasParamOperandsInOperand = (operand: OperandNode): boolean => {
  let hasParams = false;

  visitOperand(operand, {
    visitColumn: () => {},
    visitLiteral: () => {},
    visitParam: () => { hasParams = true; },
    visitFunction: (node) => {
      node.args?.forEach(arg => {
        if (hasParamOperandsInOperand(arg)) {
          hasParams = true;
        }
      });
    },
    visitJsonPath: () => {},
    visitScalarSubquery: () => {},
    visitCaseExpression: (node) => {
      node.conditions.forEach(cond => {
        if (hasParamOperandsInExpression(cond.when)) {
          hasParams = true;
        }
        if (hasParamOperandsInOperand(cond.then)) {
          hasParams = true;
        }
      });
      if (node.else && hasParamOperandsInOperand(node.else)) {
        hasParams = true;
      }
    },
    visitCast: (node) => {
      if (hasParamOperandsInOperand(node.expression)) {
        hasParams = true;
      }
    },
    visitWindowFunction: (node) => {
      node.args?.forEach(arg => {
        if (hasParamOperandsInOperand(arg)) {
          hasParams = true;
        }
      });
      node.orderBy?.forEach(ord => {
        if (ord.term) {
          if (hasParamOperandsInOperand(ord.term as OperandNode)) {
            hasParams = true;
          }
        }
      });
    },
    visitCollate: (node) => {
      if (hasParamOperandsInOperand(node.expression)) {
        hasParams = true;
      }
    },
    visitAliasRef: () => {},
    otherwise: () => {}
  });

  return hasParams;
};

export const hasParamOperandsInQuery = (ast: SelectQueryNode): boolean => {
  if (ast.where && hasParamOperandsInExpression(ast.where)) {
    return true;
  }

  if (ast.having && hasParamOperandsInExpression(ast.having)) {
    return true;
  }

  ast.columns?.forEach(col => {
    if (typeof col === 'object' && col !== null && 'type' in col) {
      if (hasParamOperandsInOperand(col as OperandNode)) {
        return true;
      }
    }
  });

  ast.orderBy?.forEach(ord => {
    if (ord.term) {
      if (hasParamOperandsInOperand(ord.term as OperandNode)) {
        return true;
      }
    }
  });

  if (ast.ctes) {
    for (const cte of ast.ctes) {
      if (cte.query.where && hasParamOperandsInExpression(cte.query.where)) {
        return true;
      }
    }
  }

  if (ast.setOps) {
    for (const op of ast.setOps) {
      if (hasParamOperandsInQuery(op.query)) {
        return true;
      }
    }
  }

  return false;
};
