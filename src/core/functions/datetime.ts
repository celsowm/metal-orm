// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column-types.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode, TypedExpression, asType } from '../ast/expression.js';

type OperandInput = OperandNode | ColumnDef | string | number | boolean | null;

const isColumnDef = (val: unknown): val is ColumnDef => !!val && typeof val === 'object' && 'type' in val && 'name' in val;

const toOperand = (input: OperandInput): OperandNode => {
    if (isOperandNode(input)) return input;
    if (isColumnDef(input)) return columnOperand(input);

    return valueToOperand(input);
};

const fn = (key: string, args: OperandInput[]): FunctionNode => ({
    type: 'Function',
    name: key,
    fn: key,
    args: args.map(toOperand)
});

const dfn = (key: string, args: OperandInput[]): TypedExpression<Date> => asType<Date>(fn(key, args));
const nfn = (key: string, args: OperandInput[]): TypedExpression<number> => asType<number>(fn(key, args));
const sfn = (key: string, args: OperandInput[]): TypedExpression<string> => asType<string>(fn(key, args));

// ----------------------
// Helper Functions
// ----------------------

/**
 * Returns the current local date and time.
 * 
 * @returns A `TypedExpression<Date>` representing the `NOW()` SQL function.
 */
export const now = (): TypedExpression<Date> => dfn('NOW', []);

/**
 * Returns the current date (without time).
 * 
 * @returns A `TypedExpression<Date>` representing the `CURRENT_DATE` SQL function.
 */
export const currentDate = (): TypedExpression<Date> => dfn('CURRENT_DATE', []);

/**
 * Returns the current time (without date).
 * 
 * @returns A `TypedExpression<Date>` representing the `CURRENT_TIME` SQL function.
 */
export const currentTime = (): TypedExpression<Date> => dfn('CURRENT_TIME', []);

/**
 * Returns the current UTC date and time.
 * 
 * @returns A `TypedExpression<Date>` representing the `UTC_NOW()` SQL function.
 */
export const utcNow = (): TypedExpression<Date> => dfn('UTC_NOW', []);

/**
 * Returns the current local time.
 * 
 * @returns A `TypedExpression<Date>` representing the `LOCALTIME` SQL function.
 */
export const localTime = (): TypedExpression<Date> => dfn('LOCALTIME', []);

/**
 * Returns the current local timestamp.
 * 
 * @returns A `TypedExpression<Date>` representing the `LOCALTIMESTAMP` SQL function.
 */
export const localTimestamp = (): TypedExpression<Date> => dfn('LOCALTIMESTAMP', []);

/**
 * Extracts a specified part from a date or datetime value.
 * 
 * @param part - The date part to extract (e.g., 'YEAR', 'MONTH', 'DAY').
 * @param date - The date/datetime value or column.
 * @returns A `TypedExpression<number>` representing the `EXTRACT` SQL function.
 */
export const extract = (part: OperandInput, date: OperandInput): TypedExpression<number> => nfn('EXTRACT', [part, date]);

/**
 * Extracts the year from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `YEAR` SQL function.
 */
export const year = (date: OperandInput): TypedExpression<number> => nfn('YEAR', [date]);

/**
 * Extracts the month from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `MONTH` SQL function.
 */
export const month = (date: OperandInput): TypedExpression<number> => nfn('MONTH', [date]);

/**
 * Extracts the day of the month from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `DAY` SQL function.
 */
export const day = (date: OperandInput): TypedExpression<number> => nfn('DAY', [date]);

/**
 * Adds a specified time interval to a date or datetime value.
 * 
 * @param date - The base date.
 * @param interval - The numeric interval to add.
 * @param unit - The unit (e.g., 'DAY', 'MONTH').
 * @returns A `TypedExpression<Date>` representing the `DATE_ADD` SQL function.
 */
export const dateAdd = (date: OperandInput, interval: OperandInput, unit: OperandInput): TypedExpression<Date> =>
    dfn('DATE_ADD', [date, interval, unit]);

/**
 * Subtracts a specified time interval from a date or datetime value.
 * 
 * @param date - The base date.
 * @param interval - The numeric interval to subtract.
 * @param unit - The unit (e.g., 'DAY', 'MONTH').
 * @returns A `TypedExpression<Date>` representing the `DATE_SUB` SQL function.
 */
export const dateSub = (date: OperandInput, interval: OperandInput, unit: OperandInput): TypedExpression<Date> =>
    dfn('DATE_SUB', [date, interval, unit]);

/**
 * Returns the difference between two dates in days.
 * 
 * @param date1 - End date.
 * @param date2 - Start date.
 * @returns A `TypedExpression<number>` representing the `DATE_DIFF` SQL function.
 */
export const dateDiff = (date1: OperandInput, date2: OperandInput): TypedExpression<number> => nfn('DATE_DIFF', [date1, date2]);

/**
 * Converts a date or datetime value to a formatted string.
 * 
 * @param date - The date value.
 * @param format - Dialect-specific format string.
 * @returns A `TypedExpression<string>` representing the `DATE_FORMAT` SQL function.
 */
export const dateFormat = (date: OperandInput, format: OperandInput): TypedExpression<string> => sfn('DATE_FORMAT', [date, format]);

/**
 * Returns the current Unix timestamp (seconds since epoch).
 * 
 * @returns A `TypedExpression<number>` representing the `UNIX_TIMESTAMP` SQL function.
 */
export const unixTimestamp = (): TypedExpression<number> => nfn('UNIX_TIMESTAMP', []);

/**
 * Converts a Unix timestamp to a Date.
 * 
 * @param timestamp - Seconds since epoch.
 * @returns A `TypedExpression<Date>` representing the `FROM_UNIXTIME` SQL function.
 */
export const fromUnixTime = (timestamp: OperandInput): TypedExpression<Date> => dfn('FROM_UNIXTIME', [timestamp]);

/**
 * Returns the last day of the month for a given date.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<Date>` representing the `END_OF_MONTH` SQL function.
 */
export const endOfMonth = (date: OperandInput): TypedExpression<Date> => dfn('END_OF_MONTH', [date]);

/**
 * Returns the index of the weekday for a given date (1 = Sunday, 2 = Monday, etc.).
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `DAY_OF_WEEK` SQL function.
 */
export const dayOfWeek = (date: OperandInput): TypedExpression<number> => nfn('DAY_OF_WEEK', [date]);

/**
 * Returns the week number of the year for a given date.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `WEEK_OF_YEAR` SQL function.
 */
export const weekOfYear = (date: OperandInput): TypedExpression<number> => nfn('WEEK_OF_YEAR', [date]);

/**
 * Truncates a date or datetime value to a specified precision.
 * 
 * @param part - The precision (e.g., 'YEAR', 'MONTH').
 * @param date - The date to truncate.
 * @returns A `TypedExpression<Date>` representing the `DATE_TRUNC` SQL function.
 */
export const dateTrunc = (part: OperandInput, date: OperandInput): TypedExpression<Date> => dfn('DATE_TRUNC', [part, date]);

/**
 * Returns the difference between two timestamps as an interval string.
 * 
 * @param timestamp - End timestamp.
 * @param baseTimestamp - Optional start timestamp.
 * @returns A `TypedExpression<string>` representing the `AGE` SQL function.
 */
export const age = (timestamp: OperandInput, baseTimestamp?: OperandInput): TypedExpression<string> =>
    baseTimestamp === undefined ? sfn('AGE', [timestamp]) : sfn('AGE', [timestamp, baseTimestamp]);

/**
 * Extracts the hour from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `HOUR` SQL function.
 */
export const hour = (date: OperandInput): TypedExpression<number> => nfn('HOUR', [date]);

/**
 * Extracts the minute from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `MINUTE` SQL function.
 */
export const minute = (date: OperandInput): TypedExpression<number> => nfn('MINUTE', [date]);

/**
 * Extracts the second from a date or datetime value.
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `SECOND` SQL function.
 */
export const second = (date: OperandInput): TypedExpression<number> => nfn('SECOND', [date]);

/**
 * Extracts the quarter from a date or datetime value (1-4).
 * 
 * @param date - The date value.
 * @returns A `TypedExpression<number>` representing the `QUARTER` SQL function.
 */
export const quarter = (date: OperandInput): TypedExpression<number> => nfn('QUARTER', [date]);

