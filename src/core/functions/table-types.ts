import type { OperandNode } from '../ast/expression.js';
import type { FunctionTableNode } from '../ast/query.js';

export interface TableFunctionRenderContext {
  node: FunctionTableNode;
  compiledArgs: string[];
  compileOperand: (operand: OperandNode) => string;
  quoteIdentifier: (id: string) => string;
}

export type TableFunctionRenderer = (ctx: TableFunctionRenderContext) => string;

export interface TableFunctionStrategy {
  getRenderer(key: string): TableFunctionRenderer | undefined;
}
