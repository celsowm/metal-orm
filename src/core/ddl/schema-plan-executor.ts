import { DbExecutor } from '../execution/db-executor.js';
import type { SchemaPlan, SynchronizeOptions } from './schema-diff.js';

/**
 * Executes a schema plan by running the SQL statements.
 * @param plan - The schema plan to execute.
 * @param executor - The database executor.
 * @param options - Options for synchronization.
 */
export const executeSchemaPlan = async (
  plan: SchemaPlan,
  executor: DbExecutor,
  options: SynchronizeOptions = {}
): Promise<void> => {
  for (const change of plan.changes) {
    if (!change.statements.length) continue;
    if (!change.safe && !options.allowDestructive) continue;
    for (const stmt of change.statements) {
      if (!stmt.trim()) continue;
      await executor.executeSql(stmt);
    }
  }
};
