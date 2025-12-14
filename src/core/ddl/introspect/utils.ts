import { DbExecutor, QueryResult } from '../../execution/db-executor.js';
import { IntrospectOptions } from './types.js';

export const toRows = (result: QueryResult | undefined): Record<string, unknown>[] => {
  if (!result) return [];
  return result.values.map(row =>
    result.columns.reduce<Record<string, unknown>>((acc, col, idx) => {
      acc[col] = row[idx];
      return acc;
    }, {})
  );
};

export const queryRows = async (
  executor: DbExecutor,
  sql: string,
  params: unknown[] = []
): Promise<Record<string, unknown>[]> => {
  const [first] = await executor.executeSql(sql, params);
  return toRows(first);
};

export const shouldIncludeTable = (name: string, options: IntrospectOptions): boolean => {
  if (options.includeTables && !options.includeTables.includes(name)) return false;
  if (options.excludeTables && options.excludeTables.includes(name)) return false;
  return true;
};
