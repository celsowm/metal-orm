import type { DbExecutor } from './db-executor.js';

export interface QueryLogEntry {
  sql: string;
  params?: unknown[];
}

export type QueryLogger = (entry: QueryLogEntry) => void;

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
