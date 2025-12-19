
import { FunctionStrategy, FunctionRenderer, FunctionRenderContext } from './types.js';
import type { LiteralNode, OperandNode } from '../ast/expression.js';
import { FunctionRegistry } from './function-registry.js';
import type { FunctionDefinition } from './function-registry.js';
import { aggregateFunctionDefinitions } from './definitions/aggregate.js';
import { stringFunctionDefinitions } from './definitions/string.js';
import { dateTimeFunctionDefinitions } from './definitions/datetime.js';
import { numericFunctionDefinitions } from './definitions/numeric.js';
import { controlFlowFunctionDefinitions } from './definitions/control-flow.js';
import { jsonFunctionDefinitions } from './definitions/json.js';
import {
  renderStandardGroupConcat,
  buildGroupConcatOrderBy as buildGroupConcatOrderByClause,
  formatGroupConcatSeparator as formatGroupConcatSeparatorClause,
  getGroupConcatSeparatorOperand as resolveGroupConcatSeparatorOperand,
  DEFAULT_GROUP_CONCAT_SEPARATOR as DEFAULT_GROUP_CONCAT_SEPARATOR_LITERAL
} from './group-concat-helpers.js';

/**
 * Standard implementation of FunctionStrategy for ANSI SQL functions.
 */
export class StandardFunctionStrategy implements FunctionStrategy {
  protected readonly registry: FunctionRegistry;

  /**
   * Creates a new StandardFunctionStrategy and registers standard functions.
   */
  constructor(registry?: FunctionRegistry) {
    this.registry = registry ?? new FunctionRegistry();
    this.registerStandard();
  }

  protected registerStandard(): void {
    this.registerDefinitions(aggregateFunctionDefinitions);
    this.registerDefinitions(stringFunctionDefinitions);
    this.registerDefinitions(dateTimeFunctionDefinitions);
    this.registerDefinitions(numericFunctionDefinitions);
    this.registerDefinitions(controlFlowFunctionDefinitions);
    this.registerDefinitions(jsonFunctionDefinitions);
    this.add('GROUP_CONCAT', ctx => this.renderGroupConcat(ctx));
  }

  protected registerDefinitions(definitions: FunctionDefinition[]): void {
    this.registry.register(definitions);
  }

  /**
   * Registers a renderer for a function name.
   * @param name - The function name.
   * @param renderer - The renderer function.
   */
  protected add(name: string, renderer: FunctionRenderer): void {
    this.registry.add(name, renderer);
  }

  /**
   * @inheritDoc
   */
  getRenderer(name: string): FunctionRenderer | undefined {
    return this.registry.get(name);
  }

  /**
   * Renders the GROUP_CONCAT function with optional ORDER BY and SEPARATOR.
   * @param ctx - The function render context.
   * @returns The rendered SQL string.
   */
  private renderGroupConcat(ctx: FunctionRenderContext): string {
    return renderStandardGroupConcat(ctx);
  }

  /**
   * Builds the ORDER BY clause for functions like GROUP_CONCAT.
   * @param ctx - The function render context.
   * @returns The ORDER BY SQL clause or empty string.
   */
  protected buildOrderByExpression(ctx: FunctionRenderContext): string {
    return buildGroupConcatOrderByClause(ctx);
  }

  /**
   * Formats the SEPARATOR clause for GROUP_CONCAT.
   * @param ctx - The function render context.
   * @returns The SEPARATOR SQL clause or empty string.
   */
  protected formatGroupConcatSeparator(ctx: FunctionRenderContext): string {
    return formatGroupConcatSeparatorClause(ctx);
  }

  /**
   * Gets the separator operand for GROUP_CONCAT, defaulting to comma.
   * @param ctx - The function render context.
   * @returns The separator operand.
   */
  protected getGroupConcatSeparatorOperand(ctx: FunctionRenderContext): OperandNode {
    return resolveGroupConcatSeparatorOperand(ctx);
  }

  /** Default separator for GROUP_CONCAT, a comma. */
  protected static readonly DEFAULT_GROUP_CONCAT_SEPARATOR: LiteralNode = DEFAULT_GROUP_CONCAT_SEPARATOR_LITERAL;
}
