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
    capabilities: executor.capabilities,
    async executeSql(sql, params) {
      logger({ sql, params });
      return executor.executeSql(sql, params);
    }
    ,
    beginTransaction: () => executor.beginTransaction(),
    commitTransaction: () => executor.commitTransaction(),
    rollbackTransaction: () => executor.rollbackTransaction(),
    dispose: () => executor.dispose(),
  };

  return wrapped;
};
