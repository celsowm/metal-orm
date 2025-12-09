import type { DbExecutor } from '../core/execution/db-executor.js';

/**
 * Executes a function within a database transaction
 * @param executor - Database executor to use for transaction operations
 * @param action - Function to execute within the transaction
 * @returns Promise that resolves when the transaction is complete
 * @throws Re-throws any errors that occur during the transaction (after rolling back)
 */
export const runInTransaction = async (executor: DbExecutor, action: () => Promise<void>): Promise<void> => {
  if (!executor.beginTransaction) {
    await action();
    return;
  }

  await executor.beginTransaction();
  try {
    await action();
    await executor.commitTransaction?.();
  } catch (error) {
    await executor.rollbackTransaction?.();
    throw error;
  }
};
