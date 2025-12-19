// Pure AST Builders - No Dialect Logic Here!

import { ColumnDef } from '../../schema/column-types.js';
import { columnOperand, valueToOperand } from '../ast/expression-builders.js';
import { FunctionNode, OperandNode, isOperandNode } from '../ast/expression.js';

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

// ----------------------
// Helper Functions
// ----------------------

/**
 * Returns the current local date and time.
 * @returns A FunctionNode representing the NOW() SQL function.
 */
export const now = (): FunctionNode => fn('NOW', []);

/**
 * Returns the current date without time.
 * @returns A FunctionNode representing the CURRENT_DATE SQL function.
 */
export const currentDate = (): FunctionNode => fn('CURRENT_DATE', []);

/**
 * Returns the current time without date.
 * @returns A FunctionNode representing the CURRENT_TIME SQL function.
 */
export const currentTime = (): FunctionNode => fn('CURRENT_TIME', []);

/**
 * Returns the current UTC date and time.
 * @returns A FunctionNode representing the UTC_NOW() SQL function.
 */
export const utcNow = (): FunctionNode => fn('UTC_NOW', []);

/**
 * Returns the current local time.
 * @returns A FunctionNode representing the LOCALTIME SQL function.
 */
export const localTime = (): FunctionNode => fn('LOCALTIME', []);

/**
 * Returns the current local timestamp.
 * @returns A FunctionNode representing the LOCALTIMESTAMP SQL function.
 */
export const localTimestamp = (): FunctionNode => fn('LOCALTIMESTAMP', []);

/**
 * Extracts a specified part from a date or datetime value.
 * @param part - The date part to extract (e.g., 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND').
 * @param date - The date or datetime value to extract from.
 * @returns A FunctionNode representing the EXTRACT SQL function.
 */
export const extract = (part: OperandInput, date: OperandInput): FunctionNode => fn('EXTRACT', [part, date]);

/**
 * Extracts the year from a date or datetime value.
 * @param date - The date or datetime value.
 * @returns A FunctionNode representing the YEAR SQL function.
 */
export const year = (date: OperandInput): FunctionNode => fn('YEAR', [date]);

/**
 * Extracts the month from a date or datetime value.
 * @param date - The date or datetime value.
 * @returns A FunctionNode representing the MONTH SQL function.
 */
export const month = (date: OperandInput): FunctionNode => fn('MONTH', [date]);

/**
 * Extracts the day of the month from a date or datetime value.
 * @param date - The date or datetime value.
 * @returns A FunctionNode representing the DAY SQL function.
 */
export const day = (date: OperandInput): FunctionNode => fn('DAY', [date]);

/**
 * Adds a specified time interval to a date or datetime value.
 * @param date - The date or datetime value to add to.
 * @param interval - The number of units to add.
 * @param unit - The unit type (e.g., 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND').
 * @returns A FunctionNode representing the DATE_ADD SQL function.
 */
export const dateAdd = (date: OperandInput, interval: OperandInput, unit: OperandInput): FunctionNode =>
    fn('DATE_ADD', [date, interval, unit]);

/**
 * Subtracts a specified time interval from a date or datetime value.
 * @param date - The date or datetime value to subtract from.
 * @param interval - The number of units to subtract.
 * @param unit - The unit type (e.g., 'DAY', 'MONTH', 'YEAR', 'HOUR', 'MINUTE', 'SECOND').
 * @returns A FunctionNode representing the DATE_SUB SQL function.
 */
export const dateSub = (date: OperandInput, interval: OperandInput, unit: OperandInput): FunctionNode =>
    fn('DATE_SUB', [date, interval, unit]);

/**
 * Returns the difference between two dates in days.
 * @param date1 - The end date.
 * @param date2 - The start date.
 * @returns A FunctionNode representing the DATE_DIFF SQL function.
 */
export const dateDiff = (date1: OperandInput, date2: OperandInput): FunctionNode => fn('DATE_DIFF', [date1, date2]);

/**
 * Converts a date or datetime value to a formatted string.
 * @param date - The date or datetime value to format.
 * @param format - The format string (dialect-specific).
 * @returns A FunctionNode representing the DATE_FORMAT SQL function.
 */
export const dateFormat = (date: OperandInput, format: OperandInput): FunctionNode => fn('DATE_FORMAT', [date, format]);

/**
 * Returns the current Unix timestamp (seconds since 1970-01-01 00:00:00 UTC).
 * @returns A FunctionNode representing the UNIX_TIMESTAMP SQL function.
 */
export const unixTimestamp = (): FunctionNode => fn('UNIX_TIMESTAMP', []);

/**
 * Converts a Unix timestamp (seconds since 1970-01-01 00:00:00 UTC) to a date.
 * @param timestamp - Unix timestamp in seconds.
 * @returns A FunctionNode representing the FROM_UNIXTIME SQL function.
 */
export const fromUnixTime = (timestamp: OperandInput): FunctionNode => fn('FROM_UNIXTIME', [timestamp]);

/**
 * Returns the last day of the month for a given date.
 * @param date - The date value.
 * @returns A FunctionNode representing the END_OF_MONTH SQL function.
 */
export const endOfMonth = (date: OperandInput): FunctionNode => fn('END_OF_MONTH', [date]);

/**
 * Returns the index of the weekday for a given date (1 = Sunday, 2 = Monday, etc.).
 * @param date - The date value.
 * @returns A FunctionNode representing the DAY_OF_WEEK SQL function.
 */
export const dayOfWeek = (date: OperandInput): FunctionNode => fn('DAY_OF_WEEK', [date]);

/**
 * Returns the week number of the year for a given date.
 * @param date - The date value.
 * @returns A FunctionNode representing the WEEK_OF_YEAR SQL function.
 */
export const weekOfYear = (date: OperandInput): FunctionNode => fn('WEEK_OF_YEAR', [date]);

/**
 * Truncates a date or datetime value to a specified precision (e.g., first day of the month/year).
 * @param part - The truncation precision (e.g., 'YEAR', 'MONTH', 'DAY').
 * @param date - The date or datetime value to truncate.
 * @returns A FunctionNode representing the DATE_TRUNC SQL function.
 */
export const dateTrunc = (part: OperandInput, date: OperandInput): FunctionNode => fn('DATE_TRUNC', [part, date]);

/**
 * Returns the difference between two timestamps as an interval.
 * @param timestamp - The end timestamp.
 * @param baseTimestamp - The start timestamp (optional, defaults to current time).
 * @returns A FunctionNode representing the AGE SQL function.
 */
export const age = (timestamp: OperandInput, baseTimestamp?: OperandInput): FunctionNode =>
    baseTimestamp === undefined ? fn('AGE', [timestamp]) : fn('AGE', [timestamp, baseTimestamp]);

