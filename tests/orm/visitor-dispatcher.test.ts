import { describe, expect, it, afterEach } from 'vitest';
import {
  visitExpression,
  visitOperand,
  registerExpressionDispatcher,
  registerOperandDispatcher,
  clearExpressionDispatchers,
  clearOperandDispatchers,
  ExpressionVisitor,
  OperandVisitor
} from '../../src/core/ast/expression.js';

afterEach(() => {
  clearExpressionDispatchers();
  clearOperandDispatchers();
});

describe('dynamic visitor dispatch', () => {
  it('dispatches custom expression types via registry', () => {
    type CustomExpression = { type: 'CustomExpression'; value: number };
    const node = { type: 'CustomExpression', value: 10 } as CustomExpression as any;

    registerExpressionDispatcher('CustomExpression', (expr, visitor) => {
      const handler = (visitor as any).visitCustom;
      if (handler) return handler(expr);
      if (visitor.otherwise) return visitor.otherwise(expr);
      throw new Error('No handler');
    });

    const visitor = {
      visitCustom: (expr: CustomExpression) => expr.value * 3
    } as ExpressionVisitor<number> & { visitCustom: (expr: CustomExpression) => number };

    expect(visitExpression(node as any, visitor)).toBe(30);
  });

  it('dispatches custom operand types via registry', () => {
    type CustomOperand = { type: 'CustomOperand'; value: string };
    const node = { type: 'CustomOperand', value: 'ok' } as CustomOperand as any;

    registerOperandDispatcher('CustomOperand', (operand, visitor) => {
      const handler = (visitor as any).visitCustomOperand;
      if (handler) return handler(operand);
      if (visitor.otherwise) return visitor.otherwise(operand);
      throw new Error('No handler');
    });

    const visitor = {
      visitCustomOperand: (operand: CustomOperand) => operand.value.toUpperCase()
    } as OperandVisitor<string> & { visitCustomOperand: (operand: CustomOperand) => string };

    expect(visitOperand(node as any, visitor)).toBe('OK');
  });
});
