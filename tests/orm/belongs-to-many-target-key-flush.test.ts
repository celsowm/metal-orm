import { describe, expect, it, vi } from 'vitest';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { toExecutionPayload } from '../../src/core/execution/db-executor.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { RelationChangeProcessor } from '../../src/orm/relation-change-processor.js';
import type { UnitOfWork } from '../../src/orm/unit-of-work.js';
import { col } from '../../src/schema/column-types.js';
import { belongsToMany } from '../../src/schema/relation.js';
import { defineTable } from '../../src/schema/table.js';

const Groups = defineTable('target_key_groups', {
  id: col.primaryKey(col.int())
});

const Users = defineTable('target_key_users', {
  id: col.primaryKey(col.int()),
  uuid: col.varchar(64)
});

const GroupUsers = defineTable('target_key_group_users', {
  id: col.primaryKey(col.int()),
  group_id: col.int(),
  user_uuid: col.varchar(64)
});

const relation = belongsToMany(Users, GroupUsers, {
  pivotForeignKeyToRoot: 'group_id',
  pivotForeignKeyToTarget: 'user_uuid',
  targetKey: 'uuid'
});

const createExecutor = (): {
  executor: DbExecutor;
  executeSql: ReturnType<typeof vi.fn>;
} => {
  const executeSql = vi.fn(async () => toExecutionPayload([]));
  const executor: DbExecutor = {
    capabilities: { transactions: false },
    executeSql,
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async dispose() {}
  };
  return { executor, executeSql };
};

const createProcessor = (executor: DbExecutor): RelationChangeProcessor =>
  new RelationChangeProcessor({} as UnitOfWork, new SqliteDialect(), executor);

describe('BelongsToMany targetKey flush', () => {
  it('uses relation.targetKey instead of the target primary key when writing the pivot', async () => {
    const { executor, executeSql } = createExecutor();
    const processor = createProcessor(executor);

    processor.registerChange({
      root: { id: 7 },
      relationKey: 'target_key_groups.users',
      rootTable: Groups,
      relationName: 'users',
      relation,
      change: {
        kind: 'attach',
        entity: { id: 42, uuid: 'user-abc' }
      }
    });

    await processor.process();

    expect(executeSql).toHaveBeenCalledTimes(1);
    expect(executeSql.mock.calls[0]?.[1]).toEqual([7, 'user-abc']);
  });

  it('can flush an id-only attach stub keyed by relation.targetKey', async () => {
    const { executor, executeSql } = createExecutor();
    const processor = createProcessor(executor);

    processor.registerChange({
      root: { id: 7 },
      relationKey: 'target_key_groups.users',
      rootTable: Groups,
      relationName: 'users',
      relation,
      change: {
        kind: 'attach',
        entity: { uuid: 'user-stub' }
      }
    });

    await processor.process();

    expect(executeSql).toHaveBeenCalledTimes(1);
    expect(executeSql.mock.calls[0]?.[1]).toEqual([7, 'user-stub']);
  });
});
