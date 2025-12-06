import {
  BinaryExpressionNode,
  LogicalExpressionNode,
  NullExpressionNode,
  InExpressionNode,
  ExistsExpressionNode,
  BetweenExpressionNode,
  ExpressionNode,
  OperandNode,
  ColumnNode,
  LiteralNode,
  FunctionNode,
  JsonPathNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode
} from './expression-nodes.js';

/**
 * Visitor for expression nodes
 */
export interface ExpressionVisitor<R> {
  visitBinaryExpression?(node: BinaryExpressionNode): R;
  visitLogicalExpression?(node: LogicalExpressionNode): R;
  visitNullExpression?(node: NullExpressionNode): R;
  visitInExpression?(node: InExpressionNode): R;
  visitExistsExpression?(node: ExistsExpressionNode): R;
  visitBetweenExpression?(node: BetweenExpressionNode): R;
  otherwise?(node: ExpressionNode): R;
}

/**
 * Visitor for operand nodes
 */
export interface OperandVisitor<R> {
  visitColumn?(node: ColumnNode): R;
  visitLiteral?(node: LiteralNode): R;
  visitFunction?(node: FunctionNode): R;
  visitJsonPath?(node: JsonPathNode): R;
  visitScalarSubquery?(node: ScalarSubqueryNode): R;
  visitCaseExpression?(node: CaseExpressionNode): R;
  visitWindowFunction?(node: WindowFunctionNode): R;
  otherwise?(node: OperandNode): R;
}

type ExpressionDispatch = <R>(node: any, visitor: ExpressionVisitor<R>) => R;
type OperandDispatch = <R>(node: any, visitor: OperandVisitor<R>) => R;

const expressionDispatchers = new Map<string, ExpressionDispatch>();
const operandDispatchers = new Map<string, OperandDispatch>();

/**
 * Registers a dispatcher for a custom expression node type.
 * Allows new node kinds without modifying the core switch.
 */
export const registerExpressionDispatcher = (type: string, dispatcher: ExpressionDispatch): void => {
  expressionDispatchers.set(type, dispatcher);
};

/**
 * Registers a dispatcher for a custom operand node type.
 * Allows new node kinds without modifying the core switch.
 */
export const registerOperandDispatcher = (type: string, dispatcher: OperandDispatch): void => {
  operandDispatchers.set(type, dispatcher);
};

/**
 * Clears all registered dispatchers. Primarily for tests.
 */
export const clearExpressionDispatchers = (): void => expressionDispatchers.clear();
export const clearOperandDispatchers = (): void => operandDispatchers.clear();

const unsupportedExpression = (node: ExpressionNode): never => {
  throw new Error(`Unsupported expression type "${(node as any)?.type ?? 'unknown'}"`);
};

const unsupportedOperand = (node: OperandNode): never => {
  throw new Error(`Unsupported operand type "${(node as any)?.type ?? 'unknown'}"`);
};
/**
 * Dispatches an expression node to the visitor
 * @param node - Expression node to visit
 * @param visitor - Visitor implementation
 */
export const visitExpression = <R>(node: ExpressionNode, visitor: ExpressionVisitor<R>): R => {
  const dynamic = expressionDispatchers.get((node as any)?.type);
  if (dynamic) return dynamic(node as any, visitor);

  switch (node.type) {
    case 'BinaryExpression':
      if (visitor.visitBinaryExpression) return visitor.visitBinaryExpression(node);
      break;
    case 'LogicalExpression':
      if (visitor.visitLogicalExpression) return visitor.visitLogicalExpression(node);
      break;
    case 'NullExpression':
      if (visitor.visitNullExpression) return visitor.visitNullExpression(node);
      break;
    case 'InExpression':
      if (visitor.visitInExpression) return visitor.visitInExpression(node);
      break;
    case 'ExistsExpression':
      if (visitor.visitExistsExpression) return visitor.visitExistsExpression(node);
      break;
    case 'BetweenExpression':
      if (visitor.visitBetweenExpression) return visitor.visitBetweenExpression(node);
      break;
    default:
      break;
  }
  if (visitor.otherwise) return visitor.otherwise(node);
  return unsupportedExpression(node);
};

/**
 * Dispatches an operand node to the visitor
 * @param node - Operand node to visit
 * @param visitor - Visitor implementation
 */
export const visitOperand = <R>(node: OperandNode, visitor: OperandVisitor<R>): R => {
  const dynamic = operandDispatchers.get((node as any)?.type);
  if (dynamic) return dynamic(node as any, visitor);

  switch (node.type) {
    case 'Column':
      if (visitor.visitColumn) return visitor.visitColumn(node);
      break;
    case 'Literal':
      if (visitor.visitLiteral) return visitor.visitLiteral(node);
      break;
    case 'Function':
      if (visitor.visitFunction) return visitor.visitFunction(node);
      break;
    case 'JsonPath':
      if (visitor.visitJsonPath) return visitor.visitJsonPath(node);
      break;
    case 'ScalarSubquery':
      if (visitor.visitScalarSubquery) return visitor.visitScalarSubquery(node);
      break;
    case 'CaseExpression':
      if (visitor.visitCaseExpression) return visitor.visitCaseExpression(node);
      break;
    case 'WindowFunction':
      if (visitor.visitWindowFunction) return visitor.visitWindowFunction(node);
      break;
    default:
      break;
  }
  if (visitor.otherwise) return visitor.otherwise(node);
  return unsupportedOperand(node);
};
