import { DbExecutor, QueryResult } from '../../execution/db-executor.js';
import { IntrospectOptions } from './types.js';

/**
 * Converts a query result to an array of row objects.
 * @param result - The query result.
 * @returns The array of rows.
 */
export const toRows = (result: QueryResult | undefined): Record<string, unknown>[] => {
  if (!result) return [];
  return result.values.map(row =>
    result.columns.reduce<Record<string, unknown>>((acc, col, idx) => {
      acc[col] = row[idx];
      return acc;
    }, {})
  );
};

/**
 * Executes a SQL query and returns the rows.
 * @param executor - The database executor.
 * @param sql - The SQL query.
 * @param params - The query parameters.
 * @returns The array of rows.
 */
export const queryRows = async (
  executor: DbExecutor,
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> => {
  const [first] = await executor.executeSql(sql, params);
  return toRows(first);
};

/**
 * Checks if a table should be included in introspection based on options.
 * @param name - The table name.
 * @param options - The introspection options.
 * @returns True if the table should be included.
 */
export const shouldIncludeTable = (name: string, options: IntrospectOptions): boolean => {
  if (options.includeTables && !options.includeTables.includes(name)) return false;
  if (options.excludeTables && options.excludeTables.includes(name)) return false;
  return true;
};

/**
 * Checks if a view should be included in introspection based on options.
 * @param name - The view name.
 * @param options - The introspection options.
 * @returns True if the view should be included.
 */
export const shouldIncludeView = (name: string, options: IntrospectOptions): boolean => {
  if (options.excludeViews && options.excludeViews.includes(name)) return false;
  return true;
};
