// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode } from '../ast/expression.js';

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
