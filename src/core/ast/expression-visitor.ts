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
} from './expression-nodes';

/**
 * Visitor for expression nodes
 */
export interface ExpressionVisitor<R> {
  visitBinaryExpression(node: BinaryExpressionNode): R;
  visitLogicalExpression(node: LogicalExpressionNode): R;
  visitNullExpression(node: NullExpressionNode): R;
  visitInExpression(node: InExpressionNode): R;
  visitExistsExpression(node: ExistsExpressionNode): R;
  visitBetweenExpression(node: BetweenExpressionNode): R;
}

/**
 * Visitor for operand nodes
 */
export interface OperandVisitor<R> {
  visitColumn(node: ColumnNode): R;
  visitLiteral(node: LiteralNode): R;
  visitFunction(node: FunctionNode): R;
  visitJsonPath(node: JsonPathNode): R;
  visitScalarSubquery(node: ScalarSubqueryNode): R;
  visitCaseExpression(node: CaseExpressionNode): R;
  visitWindowFunction(node: WindowFunctionNode): R;
}

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
  switch (node.type) {
    case 'BinaryExpression':
      return visitor.visitBinaryExpression(node);
    case 'LogicalExpression':
      return visitor.visitLogicalExpression(node);
    case 'NullExpression':
      return visitor.visitNullExpression(node);
    case 'InExpression':
      return visitor.visitInExpression(node);
    case 'ExistsExpression':
      return visitor.visitExistsExpression(node);
    case 'BetweenExpression':
      return visitor.visitBetweenExpression(node);
    default:
      return unsupportedExpression(node);
  }
};

/**
 * Dispatches an operand node to the visitor
 * @param node - Operand node to visit
 * @param visitor - Visitor implementation
 */
export const visitOperand = <R>(node: OperandNode, visitor: OperandVisitor<R>): R => {
  switch (node.type) {
    case 'Column':
      return visitor.visitColumn(node);
    case 'Literal':
      return visitor.visitLiteral(node);
    case 'Function':
      return visitor.visitFunction(node);
    case 'JsonPath':
      return visitor.visitJsonPath(node);
    case 'ScalarSubquery':
      return visitor.visitScalarSubquery(node);
    case 'CaseExpression':
      return visitor.visitCaseExpression(node);
    case 'WindowFunction':
      return visitor.visitWindowFunction(node);
    default:
      return unsupportedOperand(node);
  }
};
