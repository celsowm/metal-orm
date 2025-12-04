import type { DbExecutor } from './db-executor.js';

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
