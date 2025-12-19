import { StandardFunctionStrategy } from '../../functions/standard-strategy.js';
import { LiteralNode } from '../../ast/expression.js';

/**
 * Microsoft SQL Server specific function strategy.
 * Implements and overrides SQL function compilation rules for MSSQL.
 */
export class MssqlFunctionStrategy extends StandardFunctionStrategy {
    constructor() {
        super();
        this.registerOverrides();
    }

    private registerOverrides() {
        // Override Standard/Abstract definitions with MSSQL specifics

        // Date/Time functions
        this.add('NOW', () => `GETDATE()`);
        this.add('CURRENT_DATE', () => `CAST(GETDATE() AS DATE)`);
        this.add('CURRENT_TIME', () => `CAST(GETDATE() AS TIME)`);
        this.add('UTC_NOW', () => `GETUTCDATE()`);

        this.add('EXTRACT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
            const [part, date] = compiledArgs;
            const partClean = part.replace(/['"]/g, '').toLowerCase();
            return `DATEPART(${partClean}, ${date})`;
        });

        this.add('YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('YEAR expects 1 argument');
            return `YEAR(${compiledArgs[0]})`;
        });

        this.add('MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('MONTH expects 1 argument');
            return `MONTH(${compiledArgs[0]})`;
        });

        this.add('DAY', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY expects 1 argument');
            return `DAY(${compiledArgs[0]})`;
        });

        this.add('DATE_ADD', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `DATEADD(${unitClean}, ${interval}, ${date})`;
        });

        this.add('DATE_SUB', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
            return `DATEADD(${unitClean}, -${interval}, ${date})`;
        });

        this.add('DATE_DIFF', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
            const [date1, date2] = compiledArgs;
            return `DATEDIFF(day, ${date2}, ${date1})`;
        });

        this.add('DATE_FORMAT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
            const [date, format] = compiledArgs;
            return `FORMAT(${date}, ${format})`;
        });

        this.add('UNIX_TIMESTAMP', () => `DATEDIFF(SECOND, '1970-01-01', GETUTCDATE())`);

        this.add('FROM_UNIXTIME', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
            return `DATEADD(SECOND, ${compiledArgs[0]}, '1970-01-01')`;
        });

        this.add('END_OF_MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
            return `EOMONTH(${compiledArgs[0]})`;
        });

        this.add('DAY_OF_WEEK', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
            return `DATEPART(dw, ${compiledArgs[0]})`;
        });

        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
            return `DATEPART(wk, ${compiledArgs[0]})`;
        });

        this.add('DATE_TRUNC', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
            const [, date] = compiledArgs;
            const partArg = node.args[0] as LiteralNode;
            const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
            // SQL Server 2022+ has DATETRUNC
            return `DATETRUNC(${partClean}, ${date})`;
        });

        this.add('GROUP_CONCAT', ctx => {
            const arg = ctx.compiledArgs[0];
            const separatorOperand = this.getGroupConcatSeparatorOperand(ctx);
            const separator = ctx.compileOperand(separatorOperand);
            const orderClause = this.buildOrderByExpression(ctx);
            const withinGroup = orderClause ? ` WITHIN GROUP (${orderClause})` : '';
            return `STRING_AGG(${arg}, ${separator})${withinGroup}`;
        });

        this.add('LENGTH', ({ compiledArgs }) => `LEN(${compiledArgs[0]})`);
        this.add('CHAR_LENGTH', ({ compiledArgs }) => `LEN(${compiledArgs[0]})`);
        this.add('CHARACTER_LENGTH', ({ compiledArgs }) => `LEN(${compiledArgs[0]})`);
        this.add('POSITION', ({ compiledArgs }) => `CHARINDEX(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('LOCATE', ({ compiledArgs }) => compiledArgs.length === 3 ? `CHARINDEX(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})` : `CHARINDEX(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('INSTR', ({ compiledArgs }) => `CHARINDEX(${compiledArgs[1]}, ${compiledArgs[0]})`);
        this.add('CHR', ({ compiledArgs }) => `CHAR(${compiledArgs[0]})`);

        this.add('HOUR', ({ compiledArgs }) => `DATEPART(hour, ${compiledArgs[0]})`);
        this.add('MINUTE', ({ compiledArgs }) => `DATEPART(minute, ${compiledArgs[0]})`);
        this.add('SECOND', ({ compiledArgs }) => `DATEPART(second, ${compiledArgs[0]})`);
        this.add('QUARTER', ({ compiledArgs }) => `DATEPART(quarter, ${compiledArgs[0]})`);
    }
}
