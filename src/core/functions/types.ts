import { FunctionNode, OperandNode } from '../ast/expression.js';

/**
 * Context provided to function renderers.
 */
export interface FunctionRenderContext {
    /** The function node being rendered. */
    node: FunctionNode;
    /** The compiled arguments for the function. */
    compiledArgs: string[];
    /** Helper to compile additional operands (e.g., separators or ORDER BY columns). */
    compileOperand: (operand: OperandNode) => string;
}

/**
 * A function that renders a SQL function call.
 * @param ctx - The rendering context.
 * @returns The rendered SQL string.
 */
export type FunctionRenderer = (ctx: FunctionRenderContext) => string;

/**
 * Strategy for rendering SQL functions in a specific dialect.
 */
export interface FunctionStrategy {
    /**
     * Returns a renderer for a specific function name (e.g. "DATE_ADD").
     * Returns undefined if this dialect doesn't support the function.
     * @param functionName - The name of the function.
     * @returns The renderer function or undefined.
     */
    getRenderer(functionName: string): FunctionRenderer | undefined;
}
