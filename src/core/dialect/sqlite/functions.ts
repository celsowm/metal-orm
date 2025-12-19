import { StandardFunctionStrategy } from '../../functions/standard-strategy.js';
import { LiteralNode } from '../../ast/expression.js';

export class SqliteFunctionStrategy extends StandardFunctionStrategy {
    constructor() {
        super();
        this.registerOverrides();
    }

    private registerOverrides() {
        // Override Standard/Abstract definitions with SQLite specifics

        // Date/Time functions
        this.add('NOW', () => `datetime('now', 'localtime')`);
        this.add('CURRENT_DATE', () => `date('now', 'localtime')`);
        this.add('CURRENT_TIME', () => `time('now', 'localtime')`);
        this.add('UTC_NOW', () => `datetime('now')`);

        this.add('EXTRACT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
            const [part, date] = compiledArgs;
            // Map common parts to strftime format
            const partUpper = part.replace(/['"]/g, '').toUpperCase();
            const formatMap: Record<string, string> = {
                'YEAR': '%Y', 'MONTH': '%m', 'DAY': '%d',
                'HOUR': '%H', 'MINUTE': '%M', 'SECOND': '%S',
                'DOW': '%w', 'WEEK': '%W'
            };
            const format = formatMap[partUpper] || '%Y';
            return `CAST(strftime('${format}', ${date}) AS INTEGER)`;
        });

        this.add('YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('YEAR expects 1 argument');
            return `CAST(strftime('%Y', ${compiledArgs[0]}) AS INTEGER)`;
        });

        this.add('MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('MONTH expects 1 argument');
            return `CAST(strftime('%m', ${compiledArgs[0]}) AS INTEGER)`;
        });

        this.add('DAY', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY expects 1 argument');
            return `CAST(strftime('%d', ${compiledArgs[0]}) AS INTEGER)`;
        });

        this.add('DATE_ADD', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `datetime(${date}, '+' || ${interval} || ' ${unitClean}')`;
        });

        this.add('DATE_SUB', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `datetime(${date}, '-' || ${interval} || ' ${unitClean}')`;
        });

        this.add('DATE_DIFF', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
            const [date1, date2] = compiledArgs;
            return `CAST(julianday(${date1}) - julianday(${date2}) AS INTEGER)`;
        });

        this.add('DATE_FORMAT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
            const [date, format] = compiledArgs;
            return `strftime(${format}, ${date})`;
        });

        this.add('UNIX_TIMESTAMP', () => `CAST(strftime('%s', 'now') AS INTEGER)`);

        this.add('FROM_UNIXTIME', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
            return `datetime(${compiledArgs[0]}, 'unixepoch')`;
        });

        this.add('END_OF_MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
            return `date(${compiledArgs[0]}, 'start of month', '+1 month', '-1 day')`;
        });

        this.add('DAY_OF_WEEK', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
            return `CAST(strftime('%w', ${compiledArgs[0]}) AS INTEGER)`;
        });

        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
            return `CAST(strftime('%W', ${compiledArgs[0]}) AS INTEGER)`;
        });

        this.add('DATE_TRUNC', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
            const [, date] = compiledArgs;
            const partArg = node.args[0] as LiteralNode;
            const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
            // SQLite uses date modifiers
            if (partClean === 'year') {
                return `date(${date}, 'start of year')`;
            } else if (partClean === 'month') {
                return `date(${date}, 'start of month')`;
            } else if (partClean === 'day') {
                return `date(${date})`;
            }
            return `date(${date}, 'start of ${partClean}')`;
        });

        this.add('GROUP_CONCAT', ctx => {
            const arg = ctx.compiledArgs[0];
            const separatorOperand = this.getGroupConcatSeparatorOperand(ctx);
            const separator = ctx.compileOperand(separatorOperand);
            return `GROUP_CONCAT(${arg}, ${separator})`;
        });

        this.add('HOUR', ({ compiledArgs }) => `CAST(strftime('%H', ${compiledArgs[0]}) AS INTEGER)`);
        this.add('MINUTE', ({ compiledArgs }) => `CAST(strftime('%M', ${compiledArgs[0]}) AS INTEGER)`);
        this.add('SECOND', ({ compiledArgs }) => `CAST(strftime('%S', ${compiledArgs[0]}) AS INTEGER)`);
        this.add('QUARTER', ({ compiledArgs }) => `((CAST(strftime('%m', ${compiledArgs[0]}) AS INTEGER) + 2) / 3)`);
        this.add('CHR', ({ compiledArgs }) => `CHAR(${compiledArgs[0]})`);
    }
}
