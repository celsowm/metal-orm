import {
  BinaryExpressionNode,
  LogicalExpressionNode,
  NullExpressionNode,
  InExpressionNode,
  ExistsExpressionNode,
  BetweenExpressionNode,
  ExpressionNode,
  OperandNode,
  ArithmeticExpressionNode,
  ColumnNode,
  LiteralNode,
  FunctionNode,
  JsonPathNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  CastExpressionNode,
  WindowFunctionNode,
  CollateExpressionNode,
  AliasRefNode
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
  visitArithmeticExpression?(node: ArithmeticExpressionNode): R;
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
  visitCast?(node: CastExpressionNode): R;
  visitWindowFunction?(node: WindowFunctionNode): R;
  visitCollate?(node: CollateExpressionNode): R;
  visitAliasRef?(node: AliasRefNode): R;
  otherwise?(node: OperandNode): R;
}

type ExpressionDispatch = <R>(node: ExpressionNode, visitor: ExpressionVisitor<R>) => R;
type OperandDispatch = <R>(node: OperandNode, visitor: OperandVisitor<R>) => R;

/**
 * Registry class for managing dispatchers in an immutable way
 */
class DispatcherRegistry<T> {
  private readonly dispatchers: ReadonlyMap<string, T>;

  constructor(dispatchers: Map<string, T> = new Map()) {
    this.dispatchers = dispatchers;
  }

  /**
   * Registers a new dispatcher and returns a new registry instance
   */
  register(type: string, dispatcher: T): DispatcherRegistry<T> {
    const newMap = new Map(this.dispatchers);
    newMap.set(type, dispatcher);
    return new DispatcherRegistry(newMap);
  }

  /**
   * Gets a dispatcher for the given type
   */
  get(type: string): T | undefined {
    return this.dispatchers.get(type);
  }

  /**
   * Returns a new empty registry
   */
  clear(): DispatcherRegistry<T> {
    return new DispatcherRegistry();
  }
}

let expressionRegistry = new DispatcherRegistry<ExpressionDispatch>();
let operandRegistry = new DispatcherRegistry<OperandDispatch>();

/**
 * Registers a dispatcher for a custom expression node type.
 * Allows new node kinds without modifying the core switch.
 */
export const registerExpressionDispatcher = (type: string, dispatcher: ExpressionDispatch): void => {
  expressionRegistry = expressionRegistry.register(type, dispatcher);
};

/**
 * Registers a dispatcher for a custom operand node type.
 * Allows new node kinds without modifying the core switch.
 */
export const registerOperandDispatcher = (type: string, dispatcher: OperandDispatch): void => {
  operandRegistry = operandRegistry.register(type, dispatcher);
};

/**
 * Clears all registered dispatchers. Primarily for tests.
 */
export const clearExpressionDispatchers = (): void => {
  expressionRegistry = expressionRegistry.clear();
};

export const clearOperandDispatchers = (): void => {
  operandRegistry = operandRegistry.clear();
};

const getNodeType = (node: { type?: string } | null | undefined): string | undefined =>
  typeof node === 'object' && node !== null && typeof node.type === 'string' ? node.type : undefined;

const unsupportedExpression = (node: ExpressionNode): never => {
  throw new Error(`Unsupported expression type "${getNodeType(node) ?? 'unknown'}"`);
};

const unsupportedOperand = (node: OperandNode): never => {
  throw new Error(`Unsupported operand type "${getNodeType(node) ?? 'unknown'}"`);
};
/**
 * Dispatches an expression node to the visitor
 * @param node - Expression node to visit
 * @param visitor - Visitor implementation
 */
export const visitExpression = <R>(node: ExpressionNode, visitor: ExpressionVisitor<R>): R => {
  const dynamic = expressionRegistry.get(node.type);
  if (dynamic) return dynamic(node, visitor);

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
    case 'ArithmeticExpression':
      if (visitor.visitArithmeticExpression) return visitor.visitArithmeticExpression(node);
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
  const dynamic = operandRegistry.get(node.type);
  if (dynamic) return dynamic(node, visitor);

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
    case 'AliasRef':
      if (visitor.visitAliasRef) return visitor.visitAliasRef(node);
      break;
    case 'Cast':
      if (visitor.visitCast) return visitor.visitCast(node);
      break;
    case 'Collate':
      if (visitor.visitCollate) return visitor.visitCollate(node);
      break;
    default:
      break;
  }
  if (visitor.otherwise) return visitor.otherwise(node);
  return unsupportedOperand(node);
};
