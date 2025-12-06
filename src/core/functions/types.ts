import { FunctionNode } from '../ast/expression.js';

export interface FunctionRenderContext {
    node: FunctionNode;
    compiledArgs: string[];
    // Helper to allow dialects to call back into the compiler if needed
    // compileOperand: (node: OperandNode) => string;
}

export type FunctionRenderer = (ctx: FunctionRenderContext) => string;

export interface FunctionStrategy {
    /**
     * Returns a renderer for a specific function name (e.g. "DATE_ADD").
     * Returns undefined if this dialect doesn't support the function.
     */
    getRenderer(functionName: string): FunctionRenderer | undefined;
}
