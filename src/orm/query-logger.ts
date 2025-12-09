import type { DbExecutor } from '../core/execution/db-executor.js';

/**
 * Represents a single SQL query log entry
 */
export interface QueryLogEntry {
  /** The SQL query that was executed */
  sql: string;
  /** Parameters used in the query */
  params?: unknown[];
}

/**
 * Function type for query logging callbacks
 * @param entry - The query log entry to process
 */
export type QueryLogger = (entry: QueryLogEntry) => void;

/**
 * Creates a wrapped database executor that logs all SQL queries
 * @param executor - Original database executor to wrap
 * @param logger - Optional logger function to receive query log entries
 * @returns Wrapped executor that logs queries before execution
 */
export const createQueryLoggingExecutor = (
  executor: DbExecutor,
  logger?: QueryLogger
): DbExecutor => {
  if (!logger) {
    return executor;
  }

  const wrapped: DbExecutor = {
    async executeSql(sql, params) {
      logger({ sql, params });
      return executor.executeSql(sql, params);
    }
  };

  if (executor.beginTransaction) {
    wrapped.beginTransaction = executor.beginTransaction.bind(executor);
  }

  if (executor.commitTransaction) {
    wrapped.commitTransaction = executor.commitTransaction.bind(executor);
  }

  if (executor.rollbackTransaction) {
    wrapped.rollbackTransaction = executor.rollbackTransaction.bind(executor);
  }

  return wrapped;
};
