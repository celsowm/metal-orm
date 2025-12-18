import { FunctionStrategy, FunctionRenderer, FunctionRenderContext } from './types.js';
import { LiteralNode, OperandNode, isOperandNode } from '../ast/expression.js';

/**
 * Standard implementation of FunctionStrategy for ANSI SQL functions.
 */
export class StandardFunctionStrategy implements FunctionStrategy {
    protected renderers: Map<string, FunctionRenderer> = new Map();

    /**
     * Creates a new StandardFunctionStrategy and registers standard functions.
     */
    constructor() {
        this.registerStandard();
    }

    protected registerStandard() {
        // Register ANSI standard implementations
        this.add('COUNT', ({ compiledArgs }) => compiledArgs.length ? `COUNT(${compiledArgs.join(', ')})` : 'COUNT(*)');
        this.add('SUM', ({ compiledArgs }) => `SUM(${compiledArgs[0]})`);
        this.add('AVG', ({ compiledArgs }) => `AVG(${compiledArgs[0]})`);
        this.add('MIN', ({ compiledArgs }) => `MIN(${compiledArgs[0]})`);
        this.add('MAX', ({ compiledArgs }) => `MAX(${compiledArgs[0]})`);
        this.add('ABS', ({ compiledArgs }) => `ABS(${compiledArgs[0]})`);
        this.add('UPPER', ({ compiledArgs }) => `UPPER(${compiledArgs[0]})`);
        this.add('LOWER', ({ compiledArgs }) => `LOWER(${compiledArgs[0]})`);
        this.add('LENGTH', ({ compiledArgs }) => `LENGTH(${compiledArgs[0]})`);
        this.add('TRIM', ({ compiledArgs }) => `TRIM(${compiledArgs[0]})`);
        this.add('LTRIM', ({ compiledArgs }) => `LTRIM(${compiledArgs[0]})`);
        this.add('RTRIM', ({ compiledArgs }) => `RTRIM(${compiledArgs[0]})`);
        this.add('SUBSTRING', ({ compiledArgs }) => `SUBSTRING(${compiledArgs.join(', ')})`);
        this.add('CONCAT', ({ compiledArgs }) => `CONCAT(${compiledArgs.join(', ')})`);
        this.add('NOW', () => `NOW()`);
        this.add('CURRENT_DATE', () => `CURRENT_DATE`);
        this.add('CURRENT_TIME', () => `CURRENT_TIME`);
        this.add('EXTRACT', ({ compiledArgs }) => `EXTRACT(${compiledArgs[0]} FROM ${compiledArgs[1]})`);
        this.add('YEAR', ({ compiledArgs }) => `EXTRACT(YEAR FROM ${compiledArgs[0]})`);
        this.add('MONTH', ({ compiledArgs }) => `EXTRACT(MONTH FROM ${compiledArgs[0]})`);
        this.add('DAY', ({ compiledArgs }) => `EXTRACT(DAY FROM ${compiledArgs[0]})`);
        this.add('DATE_ADD', ({ compiledArgs }) => `(${compiledArgs[0]} + INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})`);
        this.add('DATE_SUB', ({ compiledArgs }) => `(${compiledArgs[0]} - INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})`);
        this.add('DATE_DIFF', ({ compiledArgs }) => `DATEDIFF(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('DATE_FORMAT', ({ compiledArgs }) => `DATE_FORMAT(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('UNIX_TIMESTAMP', () => `UNIX_TIMESTAMP()`);
        this.add('FROM_UNIXTIME', ({ compiledArgs }) => `FROM_UNIXTIME(${compiledArgs[0]})`);
        this.add('END_OF_MONTH', ({ compiledArgs }) => `LAST_DAY(${compiledArgs[0]})`);
        this.add('DAY_OF_WEEK', ({ compiledArgs }) => `DAYOFWEEK(${compiledArgs[0]})`);
        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => `WEEKOFYEAR(${compiledArgs[0]})`);
        this.add('DATE_TRUNC', ({ compiledArgs }) => `DATE_TRUNC(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('GROUP_CONCAT', ctx => this.renderGroupConcat(ctx));
    }

    /**
     * Registers a renderer for a function name.
     * @param name - The function name.
     * @param renderer - The renderer function.
     */
    protected add(name: string, renderer: FunctionRenderer) {
        this.renderers.set(name, renderer);
    }

    /**
     * @inheritDoc
     */
    getRenderer(name: string): FunctionRenderer | undefined {
        return this.renderers.get(name);
    }

    /**
     * Renders the GROUP_CONCAT function with optional ORDER BY and SEPARATOR.
     * @param ctx - The function render context.
     * @returns The rendered SQL string.
     */
    private renderGroupConcat(ctx: FunctionRenderContext): string {
        const arg = ctx.compiledArgs[0];
        const orderClause = this.buildOrderByExpression(ctx);
        const orderSegment = orderClause ? ` ${orderClause}` : '';
        const separatorClause = this.formatGroupConcatSeparator(ctx);
        return `GROUP_CONCAT(${arg}${orderSegment}${separatorClause})`;
    }

    /**
     * Builds the ORDER BY clause for functions like GROUP_CONCAT.
     * @param ctx - The function render context.
     * @returns The ORDER BY SQL clause or empty string.
     */
    protected buildOrderByExpression(ctx: FunctionRenderContext): string {
        const orderBy = ctx.node.orderBy;
        if (!orderBy || orderBy.length === 0) {
            return '';
        }
        const parts = orderBy.map(order => {
            const term = isOperandNode(order.term)
                ? ctx.compileOperand(order.term)
                : (() => {
                    throw new Error('ORDER BY expressions inside functions must be operands');
                })();
            const collation = order.collation ? ` COLLATE ${order.collation}` : '';
            const nulls = order.nulls ? ` NULLS ${order.nulls}` : '';
            return `${term} ${order.direction}${collation}${nulls}`;
        });
        return `ORDER BY ${parts.join(', ')}`;
    }

    /**
     * Formats the SEPARATOR clause for GROUP_CONCAT.
     * @param ctx - The function render context.
     * @returns The SEPARATOR SQL clause or empty string.
     */
    protected formatGroupConcatSeparator(ctx: FunctionRenderContext): string {
        if (!ctx.node.separator) {
            return '';
        }
        return ` SEPARATOR ${ctx.compileOperand(ctx.node.separator)}`;
    }

    /**
     * Gets the separator operand for GROUP_CONCAT, defaulting to comma.
     * @param ctx - The function render context.
     * @returns The separator operand.
     */
    protected getGroupConcatSeparatorOperand(ctx: FunctionRenderContext): OperandNode {
        return ctx.node.separator ?? StandardFunctionStrategy.DEFAULT_GROUP_CONCAT_SEPARATOR;
    }

    /** Default separator for GROUP_CONCAT, a comma. */
    protected static readonly DEFAULT_GROUP_CONCAT_SEPARATOR: LiteralNode = {
        type: 'Literal',
        value: ','
    };
}
