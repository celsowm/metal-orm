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
        this.add('CHAR_LENGTH', ({ compiledArgs }) => `CHAR_LENGTH(${compiledArgs[0]})`);
        this.add('CHARACTER_LENGTH', ({ compiledArgs }) => `CHARACTER_LENGTH(${compiledArgs[0]})`);
        this.add('TRIM', ({ compiledArgs }) => `TRIM(${compiledArgs[0]})`);
        this.add('LTRIM', ({ compiledArgs }) => `LTRIM(${compiledArgs[0]})`);
        this.add('RTRIM', ({ compiledArgs }) => `RTRIM(${compiledArgs[0]})`);
        this.add('SUBSTRING', ({ compiledArgs }) => `SUBSTRING(${compiledArgs.join(', ')})`);
        this.add('SUBSTR', ({ compiledArgs }) => `SUBSTR(${compiledArgs.join(', ')})`);
        this.add('CONCAT', ({ compiledArgs }) => `CONCAT(${compiledArgs.join(', ')})`);
        this.add('CONCAT_WS', ({ compiledArgs }) => `CONCAT_WS(${compiledArgs.join(', ')})`);
        this.add('ASCII', ({ compiledArgs }) => `ASCII(${compiledArgs[0]})`);
        this.add('CHAR', ({ compiledArgs }) => `CHAR(${compiledArgs.join(', ')})`);
        this.add('BIT_LENGTH', ({ compiledArgs }) => `BIT_LENGTH(${compiledArgs[0]})`);
        this.add('OCTET_LENGTH', ({ compiledArgs }) => `OCTET_LENGTH(${compiledArgs[0]})`);
        this.add('CHR', ({ compiledArgs }) => `CHR(${compiledArgs[0]})`);
        this.add('POSITION', ({ compiledArgs }) => `POSITION(${compiledArgs[0]} IN ${compiledArgs[1]})`);
        this.add('REPLACE', ({ compiledArgs }) => `REPLACE(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})`);
        this.add('REPEAT', ({ compiledArgs }) => `REPEAT(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('LPAD', ({ compiledArgs }) => `LPAD(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})`);
        this.add('RPAD', ({ compiledArgs }) => `RPAD(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})`);
        this.add('LEFT', ({ compiledArgs }) => `LEFT(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('RIGHT', ({ compiledArgs }) => `RIGHT(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('INSTR', ({ compiledArgs }) => `INSTR(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('LOCATE', ({ compiledArgs }) => compiledArgs.length === 3 ? `LOCATE(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})` : `LOCATE(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('SPACE', ({ compiledArgs }) => `SPACE(${compiledArgs[0]})`);
        this.add('NOW', () => `NOW()`);
        this.add('CURRENT_DATE', () => `CURRENT_DATE`);
        this.add('CURRENT_TIME', () => `CURRENT_TIME`);
        this.add('EXTRACT', ({ compiledArgs }) => `EXTRACT(${compiledArgs[0]} FROM ${compiledArgs[1]})`);
        this.add('YEAR', ({ compiledArgs }) => `EXTRACT(YEAR FROM ${compiledArgs[0]})`);
        this.add('MONTH', ({ compiledArgs }) => `EXTRACT(MONTH FROM ${compiledArgs[0]})`);
        this.add('DAY', ({ compiledArgs }) => `EXTRACT(DAY FROM ${compiledArgs[0]})`);
        this.add('HOUR', ({ compiledArgs }) => `EXTRACT(HOUR FROM ${compiledArgs[0]})`);
        this.add('MINUTE', ({ compiledArgs }) => `EXTRACT(MINUTE FROM ${compiledArgs[0]})`);
        this.add('SECOND', ({ compiledArgs }) => `EXTRACT(SECOND FROM ${compiledArgs[0]})`);
        this.add('QUARTER', ({ compiledArgs }) => `EXTRACT(QUARTER FROM ${compiledArgs[0]})`);
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

        // Control Flow
        this.add('COALESCE', ({ compiledArgs }) => `COALESCE(${compiledArgs.join(', ')})`);
        this.add('NULLIF', ({ compiledArgs }) => `NULLIF(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('GREATEST', ({ compiledArgs }) => `GREATEST(${compiledArgs.join(', ')})`);
        this.add('LEAST', ({ compiledArgs }) => `LEAST(${compiledArgs.join(', ')})`);
        this.add('IFNULL', ({ compiledArgs }) => `IFNULL(${compiledArgs[0]}, ${compiledArgs[1]})`);

        // Additional Datetime
        this.add('AGE', ({ compiledArgs }) => compiledArgs.length === 1 ? `AGE(${compiledArgs[0]})` : `AGE(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('LOCALTIME', () => 'LOCALTIME');
        this.add('LOCALTIMESTAMP', () => 'LOCALTIMESTAMP');

        // Additional Numeric
        this.add('LOG2', ({ compiledArgs }) => `LOG2(${compiledArgs[0]})`);
        this.add('CBRT', ({ compiledArgs }) => `CBRT(${compiledArgs[0]})`);
        this.add('ACOS', ({ compiledArgs }) => `ACOS(${compiledArgs[0]})`);
        this.add('ASIN', ({ compiledArgs }) => `ASIN(${compiledArgs[0]})`);
        this.add('ATAN', ({ compiledArgs }) => `ATAN(${compiledArgs[0]})`);
        this.add('ATAN2', ({ compiledArgs }) => `ATAN2(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('CEIL', ({ compiledArgs }) => `CEIL(${compiledArgs[0]})`);
        this.add('CEILING', ({ compiledArgs }) => `CEILING(${compiledArgs[0]})`);
        this.add('COS', ({ compiledArgs }) => `COS(${compiledArgs[0]})`);
        this.add('COT', ({ compiledArgs }) => `COT(${compiledArgs[0]})`);
        this.add('DEGREES', ({ compiledArgs }) => `DEGREES(${compiledArgs[0]})`);
        this.add('EXP', ({ compiledArgs }) => `EXP(${compiledArgs[0]})`);
        this.add('FLOOR', ({ compiledArgs }) => `FLOOR(${compiledArgs[0]})`);
        this.add('LN', ({ compiledArgs }) => `LN(${compiledArgs[0]})`);
        this.add('LOG', ({ compiledArgs }) => compiledArgs.length === 2 ? `LOG(${compiledArgs[0]}, ${compiledArgs[1]})` : `LOG(${compiledArgs[0]})`);
        this.add('LOG10', ({ compiledArgs }) => `LOG10(${compiledArgs[0]})`);
        this.add('LOG_BASE', ({ compiledArgs }) => `LOG(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('MOD', ({ compiledArgs }) => `MOD(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('PI', () => `PI()`);
        this.add('POWER', ({ compiledArgs }) => `POWER(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('POW', ({ compiledArgs }) => `POW(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('RADIANS', ({ compiledArgs }) => `RADIANS(${compiledArgs[0]})`);
        this.add('RANDOM', () => `RANDOM()`);
        this.add('RAND', () => `RAND()`);
        this.add('ROUND', ({ compiledArgs }) => compiledArgs.length === 2 ? `ROUND(${compiledArgs[0]}, ${compiledArgs[1]})` : `ROUND(${compiledArgs[0]})`);
        this.add('SIGN', ({ compiledArgs }) => `SIGN(${compiledArgs[0]})`);
        this.add('SIN', ({ compiledArgs }) => `SIN(${compiledArgs[0]})`);
        this.add('SQRT', ({ compiledArgs }) => `SQRT(${compiledArgs[0]})`);
        this.add('TAN', ({ compiledArgs }) => `TAN(${compiledArgs[0]})`);
        this.add('TRUNC', ({ compiledArgs }) => compiledArgs.length === 2 ? `TRUNC(${compiledArgs[0]}, ${compiledArgs[1]})` : `TRUNC(${compiledArgs[0]})`);
        this.add('TRUNCATE', ({ compiledArgs }) => `TRUNCATE(${compiledArgs[0]}, ${compiledArgs[1]})`);

        // Additional Text
        this.add('REVERSE', ({ compiledArgs }) => `REVERSE(${compiledArgs[0]})`);
        this.add('INITCAP', ({ compiledArgs }) => `INITCAP(${compiledArgs[0]})`);
        this.add('MD5', ({ compiledArgs }) => `MD5(${compiledArgs[0]})`);
        this.add('SHA1', ({ compiledArgs }) => `SHA1(${compiledArgs[0]})`);
        this.add('SHA2', ({ compiledArgs }) => `SHA2(${compiledArgs[0]}, ${compiledArgs[1]})`);

        // Additional Aggregates
        this.add('STDDEV', ({ compiledArgs }) => `STDDEV(${compiledArgs[0]})`);
        this.add('VARIANCE', ({ compiledArgs }) => `VARIANCE(${compiledArgs[0]})`);

        // JSON / Array helpers
        this.add('JSON_LENGTH', ({ compiledArgs }) => {
            if (compiledArgs.length === 0 || compiledArgs.length > 2) {
                throw new Error('JSON_LENGTH expects 1 or 2 arguments');
            }
            return `JSON_LENGTH(${compiledArgs.join(', ')})`;
        });
        this.add('JSON_SET', ({ compiledArgs }) => {
            if (compiledArgs.length < 3 || (compiledArgs.length - 1) % 2 !== 0) {
                throw new Error('JSON_SET expects a JSON document followed by one or more path/value pairs');
            }
            return `JSON_SET(${compiledArgs.join(', ')})`;
        });
        this.add('JSON_ARRAYAGG', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) {
                throw new Error('JSON_ARRAYAGG expects exactly one argument');
            }
            return `JSON_ARRAYAGG(${compiledArgs[0]})`;
        });
        this.add('JSON_CONTAINS', ({ compiledArgs }) => {
            if (compiledArgs.length < 2 || compiledArgs.length > 3) {
                throw new Error('JSON_CONTAINS expects two or three arguments');
            }
            return `JSON_CONTAINS(${compiledArgs.join(', ')})`;
        });
        this.add('ARRAY_APPEND', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) {
                throw new Error('ARRAY_APPEND expects exactly two arguments');
            }
            return `ARRAY_APPEND(${compiledArgs[0]}, ${compiledArgs[1]})`;
        });
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
