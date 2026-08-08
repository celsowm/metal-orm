import type { TableDef } from '../schema/table.js';

/**
 * Entity lifecycle hooks executed by the Unit of Work.
 *
 * Hooks are runtime/session configuration. They are intentionally not stored on
 * TableDef so the same mapping can be used by independent sessions with
 * different lifecycle policies.
 */
export interface TableHooks<TEntity = unknown, TContext = unknown> {
  beforeInsert?(ctx: TContext, entity: TEntity): Promise<void> | void;
  afterInsert?(ctx: TContext, entity: TEntity): Promise<void> | void;
  beforeUpdate?(ctx: TContext, entity: TEntity): Promise<void> | void;
  afterUpdate?(ctx: TContext, entity: TEntity): Promise<void> | void;
  beforeDelete?(ctx: TContext, entity: TEntity): Promise<void> | void;
  afterDelete?(ctx: TContext, entity: TEntity): Promise<void> | void;
}

/** @internal */
export type TableHookResolver = (table: TableDef) => TableHooks | undefined;
