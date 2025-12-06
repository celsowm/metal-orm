import { ColumnDef } from '../../schema/column.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode, LiteralNode } from '../ast/expression.js';
import type { FunctionRegistry, SqlFunctionDefinition } from './function-registry.js';

type OperandInput = OperandNode | ColumnDef | string | number | boolean | null;

const isColumnDef = (val: any): val is ColumnDef => !!val && typeof val === 'object' && 'type' in val && 'name' in val;

const toOperand = (input: OperandInput): OperandNode => {
    if (isOperandNode(input)) return input;
    if (isColumnDef(input)) return columnOperand(input);
    return valueToOperand(input as any);
};

const fn = (key: string, args: OperandInput[]): FunctionNode => ({
    type: 'Function',
    name: key,
    fn: key,
    args: args.map(toOperand)
});

// ----------------------
// Helper Functions
// ----------------------

/**
 * Helper: NOW() - Returns the current local date and time
 */
export const now = (): FunctionNode => fn('NOW', []);

/**
 * Helper: CURRENT_DATE - Returns only the current date (no time)
 */
export const currentDate = (): FunctionNode => fn('CURRENT_DATE', []);

/**
 * Helper: CURRENT_TIME - Returns only the current time
 */
export const currentTime = (): FunctionNode => fn('CURRENT_TIME', []);

/**
 * Helper: UTC_NOW() - Returns current UTC/GMT date and time
 */
export const utcNow = (): FunctionNode => fn('UTC_NOW', []);

/**
 * Helper: EXTRACT(part FROM date) - Extracts a part (year, month, day, hour, etc.) from a date
 * @param part - The date part to extract (e.g., 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND')
 * @param date - The date/datetime value
 */
export const extract = (part: OperandInput, date: OperandInput): FunctionNode => fn('EXTRACT', [part, date]);

/**
 * Helper: YEAR(date) - Extracts the year from a date
 */
export const year = (date: OperandInput): FunctionNode => fn('YEAR', [date]);

/**
 * Helper: MONTH(date) - Extracts the month from a date
 */
export const month = (date: OperandInput): FunctionNode => fn('MONTH', [date]);

/**
 * Helper: DAY(date) - Extracts the day from a date
 */
export const day = (date: OperandInput): FunctionNode => fn('DAY', [date]);

/**
 * Helper: DATE_ADD(date, interval, unit) - Adds a specific time interval to a date
 * @param date - The date/datetime value
 * @param interval - The number of units to add
 * @param unit - The unit type (e.g., 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND')
 */
export const dateAdd = (date: OperandInput, interval: OperandInput, unit: OperandInput): FunctionNode =>
    fn('DATE_ADD', [date, interval, unit]);

/**
 * Helper: DATE_SUB(date, interval, unit) - Subtracts a specific time interval from a date
 * @param date - The date/datetime value
 * @param interval - The number of units to subtract
 * @param unit - The unit type (e.g., 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND')
 */
export const dateSub = (date: OperandInput, interval: OperandInput, unit: OperandInput): FunctionNode =>
    fn('DATE_SUB', [date, interval, unit]);

/**
 * Helper: DATE_DIFF(date1, date2) - Returns the difference between two dates in days
 * @param date1 - The end date
 * @param date2 - The start date
 */
export const dateDiff = (date1: OperandInput, date2: OperandInput): FunctionNode => fn('DATE_DIFF', [date1, date2]);

/**
 * Helper: DATE_FORMAT(date, format) - Converts a date to a formatted string
 * @param date - The date/datetime value
 * @param format - The format string (dialect-specific)
 */
export const dateFormat = (date: OperandInput, format: OperandInput): FunctionNode => fn('DATE_FORMAT', [date, format]);

/**
 * Helper: UNIX_TIMESTAMP() - Returns the current Unix epoch (seconds since 1970)
 */
export const unixTimestamp = (): FunctionNode => fn('UNIX_TIMESTAMP', []);

/**
 * Helper: FROM_UNIXTIME(timestamp) - Converts Unix epoch seconds to a date
 * @param timestamp - Unix timestamp in seconds
 */
export const fromUnixTime = (timestamp: OperandInput): FunctionNode => fn('FROM_UNIXTIME', [timestamp]);

/**
 * Helper: END_OF_MONTH(date) - Returns the last day of the month for a given date
 */
export const endOfMonth = (date: OperandInput): FunctionNode => fn('END_OF_MONTH', [date]);

/**
 * Helper: DAY_OF_WEEK(date) - Returns the index of the weekday
 */
export const dayOfWeek = (date: OperandInput): FunctionNode => fn('DAY_OF_WEEK', [date]);

/**
 * Helper: WEEK_OF_YEAR(date) - Returns the week number of the year
 */
export const weekOfYear = (date: OperandInput): FunctionNode => fn('WEEK_OF_YEAR', [date]);

/**
 * Helper: DATE_TRUNC(part, date) - Resets date precision (e.g., first day of the month/year)
 * @param part - The truncation precision (e.g., 'YEAR', 'MONTH', 'DAY')
 * @param date - The date/datetime value
 */
export const dateTrunc = (part: OperandInput, date: OperandInput): FunctionNode => fn('DATE_TRUNC', [part, date]);

// ----------------------
// Registry declarations
// ----------------------

const simple =
    (registry: FunctionRegistry) =>
        (
            key: string,
            defaultName?: string,
            variants?: SqlFunctionDefinition['variants'],
            render?: SqlFunctionDefinition['render']
        ): void => {
            registry.register({ key, defaultName, variants, render });
        };

export const registerDateTimeFunctions = (registry: FunctionRegistry): void => {
    const register = simple(registry);

    // NOW - Current local date and time
    register('NOW', 'NOW', {
        sqlite: {
            render: () => `datetime('now', 'localtime')`
        },
        mssql: { name: 'GETDATE' }
    });

    // CURRENT_DATE - Current date only
    register('CURRENT_DATE', 'CURRENT_DATE', {
        sqlite: {
            render: () => `date('now', 'localtime')`
        },
        mysql: { name: 'CURDATE' },
        mssql: {
            render: () => `CAST(GETDATE() AS DATE)`
        }
    });

    // CURRENT_TIME - Current time only
    register('CURRENT_TIME', 'CURRENT_TIME', {
        sqlite: {
            render: () => `time('now', 'localtime')`
        },
        mysql: { name: 'CURTIME' },
        mssql: {
            render: () => `CAST(GETDATE() AS TIME)`
        }
    });

    // UTC_NOW - Current UTC date and time
    register('UTC_NOW', undefined, {
        sqlite: {
            render: () => `datetime('now')`
        },
        postgres: {
            render: () => `(NOW() AT TIME ZONE 'UTC')`
        },
        mysql: { name: 'UTC_TIMESTAMP' },
        mssql: { name: 'GETUTCDATE' }
    });

    // EXTRACT - Extract part from date
    register('EXTRACT', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
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
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
                const [part, date] = compiledArgs;
                const partClean = part.replace(/['"]/g, '');
                return `EXTRACT(${partClean} FROM ${date})`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
                const [part, date] = compiledArgs;
                const partClean = part.replace(/['"]/g, '');
                return `EXTRACT(${partClean} FROM ${date})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('EXTRACT expects 2 arguments (part, date)');
                const [part, date] = compiledArgs;
                const partClean = part.replace(/['"]/g, '').toLowerCase();
                return `DATEPART(${partClean}, ${date})`;
            }
        }
    });

    // YEAR - Extract year
    register('YEAR', 'YEAR', {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('YEAR expects 1 argument');
                return `CAST(strftime('%Y', ${compiledArgs[0]}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('YEAR expects 1 argument');
                return `EXTRACT(YEAR FROM ${compiledArgs[0]})`;
            }
        }
    });

    // MONTH - Extract month
    register('MONTH', 'MONTH', {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('MONTH expects 1 argument');
                return `CAST(strftime('%m', ${compiledArgs[0]}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('MONTH expects 1 argument');
                return `EXTRACT(MONTH FROM ${compiledArgs[0]})`;
            }
        }
    });

    // DAY - Extract day
    register('DAY', 'DAY', {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY expects 1 argument');
                return `CAST(strftime('%d', ${compiledArgs[0]}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY expects 1 argument');
                return `EXTRACT(DAY FROM ${compiledArgs[0]})`;
            }
        }
    });

    // DATE_ADD - Add interval to date
    register('DATE_ADD', undefined, {
        sqlite: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `datetime(${date}, '+' || ${interval} || ' ${unitClean}')`;
            }
        },
        postgres: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `(${date} + (${interval} || ' ${unitClean}')::INTERVAL)`;
            }
        },
        mysql: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toUpperCase();
                return `DATE_ADD(${date}, INTERVAL ${interval} ${unitClean})`;
            }
        },
        mssql: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_ADD expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `DATEADD(${unitClean}, ${interval}, ${date})`;
            }
        }
    });

    // DATE_SUB - Subtract interval from date
    register('DATE_SUB', undefined, {
        sqlite: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `datetime(${date}, '-' || ${interval} || ' ${unitClean}')`;
            }
        },
        postgres: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `(${date} - (${interval} || ' ${unitClean}')::INTERVAL)`;
            }
        },
        mysql: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toUpperCase();
                return `DATE_SUB(${date}, INTERVAL ${interval} ${unitClean})`;
            }
        },
        mssql: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 3) throw new Error('DATE_SUB expects 3 arguments (date, interval, unit)');
                const [date, interval] = compiledArgs;
                const unitArg = node.args[2] as LiteralNode;
                const unitClean = String(unitArg.value).replace(/['"]/g, '').toLowerCase();
                return `DATEADD(${unitClean}, -${interval}, ${date})`;
            }
        }
    });

    // DATE_DIFF - Difference between dates in days
    register('DATE_DIFF', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
                const [date1, date2] = compiledArgs;
                return `CAST(julianday(${date1}) - julianday(${date2}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
                const [date1, date2] = compiledArgs;
                return `(${date1}::DATE - ${date2}::DATE)`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
                const [date1, date2] = compiledArgs;
                return `DATEDIFF(${date1}, ${date2})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_DIFF expects 2 arguments');
                const [date1, date2] = compiledArgs;
                return `DATEDIFF(day, ${date2}, ${date1})`;
            }
        }
    });

    // DATE_FORMAT - Format date as string
    register('DATE_FORMAT', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
                const [date, format] = compiledArgs;
                return `strftime(${format}, ${date})`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
                const [date, format] = compiledArgs;
                return `TO_CHAR(${date}, ${format})`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
                const [date, format] = compiledArgs;
                return `DATE_FORMAT(${date}, ${format})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_FORMAT expects 2 arguments');
                const [date, format] = compiledArgs;
                return `FORMAT(${date}, ${format})`;
            }
        }
    });

    // UNIX_TIMESTAMP - Current Unix epoch seconds
    register('UNIX_TIMESTAMP', 'UNIX_TIMESTAMP', {
        sqlite: {
            render: () => `CAST(strftime('%s', 'now') AS INTEGER)`
        },
        postgres: {
            render: () => `EXTRACT(EPOCH FROM NOW())::INTEGER`
        },
        mssql: {
            render: () => `DATEDIFF(SECOND, '1970-01-01', GETUTCDATE())`
        }
    });

    // FROM_UNIXTIME - Convert Unix timestamp to date
    register('FROM_UNIXTIME', 'FROM_UNIXTIME', {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
                return `datetime(${compiledArgs[0]}, 'unixepoch')`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
                return `to_timestamp(${compiledArgs[0]})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('FROM_UNIXTIME expects 1 argument');
                return `DATEADD(SECOND, ${compiledArgs[0]}, '1970-01-01')`;
            }
        }
    });

    // END_OF_MONTH - Last day of month
    register('END_OF_MONTH', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
                return `date(${compiledArgs[0]}, 'start of month', '+1 month', '-1 day')`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
                return `(date_trunc('month', ${compiledArgs[0]}) + interval '1 month' - interval '1 day')::DATE`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
                return `LAST_DAY(${compiledArgs[0]})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('END_OF_MONTH expects 1 argument');
                return `EOMONTH(${compiledArgs[0]})`;
            }
        }
    });

    // DAY_OF_WEEK - Day of week index
    register('DAY_OF_WEEK', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
                return `CAST(strftime('%w', ${compiledArgs[0]}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
                return `EXTRACT(DOW FROM ${compiledArgs[0]})`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
                return `DAYOFWEEK(${compiledArgs[0]})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('DAY_OF_WEEK expects 1 argument');
                return `DATEPART(dw, ${compiledArgs[0]})`;
            }
        }
    });

    // WEEK_OF_YEAR - Week number of year
    register('WEEK_OF_YEAR', undefined, {
        sqlite: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
                return `CAST(strftime('%W', ${compiledArgs[0]}) AS INTEGER)`;
            }
        },
        postgres: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
                return `EXTRACT(WEEK FROM ${compiledArgs[0]})`;
            }
        },
        mysql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
                return `WEEKOFYEAR(${compiledArgs[0]})`;
            }
        },
        mssql: {
            render: ({ compiledArgs }) => {
                if (compiledArgs.length !== 1) throw new Error('WEEK_OF_YEAR expects 1 argument');
                return `DATEPART(wk, ${compiledArgs[0]})`;
            }
        }
    });

    // DATE_TRUNC - Truncate date to precision
    register('DATE_TRUNC', undefined, {
        sqlite: {
            render: ({ node, compiledArgs }) => {
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
            }
        },
        postgres: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
                const [, date] = compiledArgs;
                const partArg = node.args[0] as LiteralNode;
                const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
                return `DATE_TRUNC('${partClean}', ${date})`;
            }
        },
        mysql: {
            render: ({ node, compiledArgs }) => {
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
            }
        },
        mssql: {
            render: ({ node, compiledArgs }) => {
                if (compiledArgs.length !== 2) throw new Error('DATE_TRUNC expects 2 arguments (part, date)');
                const [, date] = compiledArgs;
                const partArg = node.args[0] as LiteralNode;
                const partClean = String(partArg.value).replace(/['"]/g, '').toLowerCase();
                // SQL Server 2022+ has DATETRUNC
                return `DATETRUNC(${partClean}, ${date})`;
            }
        }
    });
};
