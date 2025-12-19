import { StandardFunctionStrategy } from '../../functions/standard-strategy.js';
import { LiteralNode } from '../../ast/expression.js';

/**
 * PostgreSQL specific function strategy.
 * Implements and overrides SQL function compilation rules for PostgreSQL.
 */
export class PostgresFunctionStrategy extends StandardFunctionStrategy {
    constructor() {
        super();
        this.registerOverrides();
    }

    private registerOverrides() {
        // Override Standard/Abstract definitions with PostgreSQL specifics

        // Date/Time functions
        this.add('UTC_NOW', () => `(NOW() AT TIME ZONE 'UTC')`);
        this.add('UNIX_TIMESTAMP', () => `EXTRACT(EPOCH FROM NOW())::INTEGER`);
        this.add('FROM_UNIXTIME', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
            return `to_timestamp(${compiledArgs[0]})`;
        });

        this.add('EXTRACT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
            const [part, date] = compiledArgs;
            const partClean = part.replace(/['"]/g, '');
            return `EXTRACT(${partClean} FROM ${date})`;
        });

        this.add('YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('YEAR expects 1 argument');
            return `EXTRACT(YEAR FROM ${compiledArgs[0]})`;
        });

        this.add('MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('MONTH expects 1 argument');
            return `EXTRACT(MONTH FROM ${compiledArgs[0]})`;
        });

        this.add('DAY', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY expects 1 argument');
            return `EXTRACT(DAY FROM ${compiledArgs[0]})`;
        });

        this.add('DATE_ADD', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `(${date} + (${interval} || ' ${unitClean}')::INTERVAL)`;
        });

        this.add('DATE_SUB', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `(${date} - (${interval} || ' ${unitClean}')::INTERVAL)`;
        });

        this.add('DATE_DIFF', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
            const [date1, date2] = compiledArgs;
            return `(${date1}::DATE - ${date2}::DATE)`;
        });

        this.add('DATE_FORMAT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
            const [date, format] = compiledArgs;
            return `TO_CHAR(${date}, ${format})`;
        });

        this.add('END_OF_MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
            return `(date_trunc('month', ${compiledArgs[0]}) + interval '1 month' - interval '1 day')::DATE`;
        });

        this.add('DAY_OF_WEEK', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
            return `EXTRACT(DOW FROM ${compiledArgs[0]})`;
        });

        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
            return `EXTRACT(WEEK FROM ${compiledArgs[0]})`;
        });

        this.add('DATE_TRUNC', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
            const [, date] = compiledArgs;
            const partArg = node.args[0] as LiteralNode;
            const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
            return `DATE_TRUNC('${partClean}', ${date})`;
        });

        this.add('GROUP_CONCAT', ctx => {
            const arg = ctx.compiledArgs[0];
            const orderClause = this.buildOrderByExpression(ctx);
            const orderSegment = orderClause ? ` ${orderClause}` : '';
            const separatorOperand = this.getGroupConcatSeparatorOperand(ctx);
            const separator = ctx.compileOperand(separatorOperand);
            return `STRING_AGG(${arg}, ${separator}${orderSegment})`;
        });

        this.add('CHR', ({ compiledArgs }) => `CHR(${compiledArgs[0]})`);

        this.add('HOUR', ({ compiledArgs }) => `EXTRACT(HOUR FROM ${compiledArgs[0]})`);
        this.add('MINUTE', ({ compiledArgs }) => `EXTRACT(MINUTE FROM ${compiledArgs[0]})`);
        this.add('SECOND', ({ compiledArgs }) => `EXTRACT(SECOND FROM ${compiledArgs[0]})`);
        this.add('QUARTER', ({ compiledArgs }) => `EXTRACT(QUARTER FROM ${compiledArgs[0]})`);
    }
}
