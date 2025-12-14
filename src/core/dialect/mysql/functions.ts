import { StandardFunctionStrategy } from '../../functions/standard-strategy.js';
import { LiteralNode } from '../../ast/expression.js';

export class MysqlFunctionStrategy extends StandardFunctionStrategy {
    constructor() {
        super();
        this.registerOverrides();
    }

    private registerOverrides() {
        // Override Standard/Abstract definitions with MySQL specifics

        // Date/Time functions
        this.add('NOW', () => `NOW()`);
        this.add('CURRENT_DATE', () => `CURDATE()`);
        this.add('CURRENT_TIME', () => `CURTIME()`);
        this.add('UTC_NOW', () => `UTC_TIMESTAMP()`);

        this.add('EXTRACT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
            const [part, date] = compiledArgs;
            const partClean = part.replace(/['"]/g, '');
            return `EXTRACT(${partClean} FROM ${date})`;
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
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toUpperCase();
            return `DATE_ADD(${date}, INTERVAL ${interval} ${unitClean})`;
        });

        this.add('DATE_SUB', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
            const [date, interval] = compiledArgs;
            const unitArg = node.args[2] as LiteralNode;
            const unitClean = String(unitArg.value).replace(/['"]/g, '').toUpperCase();
            return `DATE_SUB(${date}, INTERVAL ${interval} ${unitClean})`;
        });

        this.add('DATE_DIFF', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
            const [date1, date2] = compiledArgs;
            return `DATEDIFF(${date1}, ${date2})`;
        });

        this.add('DATE_FORMAT', ({ compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
            const [date, format] = compiledArgs;
            return `DATE_FORMAT(${date}, ${format})`;
        });

        this.add('END_OF_MONTH', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
            return `LAST_DAY(${compiledArgs[0]})`;
        });

        this.add('DAY_OF_WEEK', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
            return `DAYOFWEEK(${compiledArgs[0]})`;
        });

        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => {
            if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
            return `WEEKOFYEAR(${compiledArgs[0]})`;
        });

        this.add('DATE_TRUNC', ({ node, compiledArgs }) => {
            if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
            const [, date] = compiledArgs;
            const partArg = node.args[0] as LiteralNode;
            const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
            // MySQL doesn't have DATE_TRUNC, use DATE_FORMAT workaround
            if (partClean === 'year') {
                return `DATE_FORMAT(${date}, '%Y-01-01')`;
            } else if (partClean === 'month') {
                return `DATE_FORMAT(${date}, '%Y-%m-01')`;
            } else if (partClean === 'day') {
                return `DATE(${date})`;
            }
            return `DATE(${date})`;
        });
    }
}
