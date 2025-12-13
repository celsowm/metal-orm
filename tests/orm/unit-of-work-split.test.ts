import { describe, expect, it, vi } from 'vitest';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { IdentityMap } from '../../src/orm/identity-map.js';
import { UnitOfWork } from '../../src/orm/unit-of-work.js';
import { RelationChangeProcessor } from '../../src/orm/relation-change-processor.js';
import { DomainEventBus, addDomainEvent } from '../../src/orm/domain-event-bus.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column.js';
import { hasMany, belongsToMany } from '../../src/schema/relation.js';
import type { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import type { HasDomainEvents, RelationChangeEntry, TrackedEntity } from '../../src/orm/runtime-types.js';

const createExecutor = (responses: QueryResult[][] = []) => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];
  let callIndex = 0;
  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]> {
      executed.push({ sql, params });
      const response = responses[callIndex] ?? [];
      callIndex += 1;
      return response;
    },
    beginTransaction: async () => {
      throw new Error('Transactions are not supported by this test executor');
    },
    commitTransaction: async () => {
      throw new Error('Transactions are not supported by this test executor');
    },
    rollbackTransaction: async () => {
      throw new Error('Transactions are not supported by this test executor');
    },
    dispose: async () => { },
  };
  return { executor, executed };
};

describe('UnitOfWork', () => {
  it('flushes insert/update/delete and keeps identity map in sync', async () => {
    const { executor, executed } = createExecutor();
    const dialect = new SqliteDialect();
    const identity = new IdentityMap();
    const ctx = { tag: 'ctx' };
    const table = defineTable(
      'uow_users',
      {
        id: col.primaryKey(col.int()),
        name: col.varchar(50)
      },
      {},
      {
        beforeInsert: vi.fn(),
        afterInsert: vi.fn(),
        beforeUpdate: vi.fn(),
        afterUpdate: vi.fn(),
        beforeDelete: vi.fn(),
        afterDelete: vi.fn()
      }
    );

    const uow = new UnitOfWork(dialect, executor, identity, () => ctx);

    const entity = { id: 1, name: 'Alice' };
    uow.trackNew(table, entity);
    await uow.flush();

    expect(executed[0].sql).toContain('INSERT INTO "uow_users"');
    expect(table.hooks?.beforeInsert).toHaveBeenCalledWith(ctx, entity);
    expect(identity.getEntity(table, 1)).toBe(entity);

    entity.name = 'Bob';
    uow.markDirty(entity);
    await uow.flush();

    expect(executed[1].sql).toContain('UPDATE "uow_users"');
    expect(table.hooks?.afterUpdate).toHaveBeenCalledWith(ctx, entity);

    uow.markRemoved(entity);
    await uow.flush();

    expect(executed[2].sql).toContain('DELETE FROM "uow_users"');
    expect(table.hooks?.afterDelete).toHaveBeenCalledWith(ctx, entity);
    expect(identity.getEntity(table, 1)).toBeUndefined();
  });

  it('applies RETURNING rows when the dialect supports them', async () => {
    const responses: QueryResult[][] = [
      [
        {
          columns: ['id', 'name'],
          values: [[10, 'Created via RETURNING']]
        }
      ],
      [
        {
          columns: ['id', 'name'],
          values: [[10, 'Updated via RETURNING']]
        }
      ]
    ];
    const { executor, executed } = createExecutor(responses);
    const dialect = new SqliteDialect();
    const identity = new IdentityMap();
    const ctx = { tag: 'ctx' };

    const table = defineTable('returning_users', {
      id: col.primaryKey(col.int()),
      name: col.varchar(50)
    });

    const uow = new UnitOfWork(dialect, executor, identity, () => ctx);
    const entity: any = { id: null, name: 'local' };
    uow.trackNew(table, entity);

    await uow.flush();
    expect(entity.id).toBe(10);
    expect(entity.name).toBe('Created via RETURNING');
    expect(executed[0].sql).toContain('RETURNING');

    entity.name = 'local update';
    uow.markDirty(entity);
    await uow.flush();
    expect(entity.name).toBe('Updated via RETURNING');
    expect(executed[1].sql).toContain('RETURNING');
  });
});

describe('RelationChangeProcessor', () => {
  it('propagates has-many foreign keys and cascades removal', async () => {
    const { executor } = createExecutor();
    const dialect = new SqliteDialect();
    class FakeUnitOfWork {
      tracked = new Map<any, TrackedEntity>();
      markDirty = vi.fn();
      markRemoved = vi.fn();
      findTracked = (entity: any): TrackedEntity | undefined => this.tracked.get(entity);
    }
    const unit = new FakeUnitOfWork();
    const rootTable = defineTable('parents', { id: col.primaryKey(col.int()) });
    const childTable = defineTable('children', { id: col.primaryKey(col.int()), parent_id: col.int() });
    const processor = new RelationChangeProcessor(unit as any, dialect, executor);

    const root = { id: 10 };
    const child = { id: 20, parent_id: null };
    unit.tracked.set(child, { entity: child } as TrackedEntity);

    const attachChange: RelationChangeEntry = {
      root,
      relationKey: 'parents.children',
      rootTable,
      relationName: 'children',
      relation: hasMany(childTable, 'parent_id'),
      change: { kind: 'add', entity: child }
    };

    processor.registerChange(attachChange);
    await processor.process();

    expect(child.parent_id).toBe(10);
    expect(unit.markDirty).toHaveBeenCalledWith(child);

    const removeChange: RelationChangeEntry = {
      root,
      relationKey: 'parents.children',
      rootTable,
      relationName: 'children',
      relation: hasMany(childTable, 'parent_id', undefined, 'remove'),
      change: { kind: 'remove', entity: child }
    };
    processor.registerChange(removeChange);
    await processor.process();
    expect(unit.markRemoved).toHaveBeenCalledWith(child);
  });

  it('writes pivot rows and cascades detach for belongs-to-many', async () => {
    const { executor, executed } = createExecutor();
    const dialect = new SqliteDialect();
    class FakeUnitOfWork {
      markRemoved = vi.fn();
      markDirty = vi.fn();
      findTracked = (): TrackedEntity | undefined => undefined;
    }
    const unit = new FakeUnitOfWork();
    const rootTable = defineTable('users', { id: col.primaryKey(col.int()) });
    const targetTable = defineTable('roles', { id: col.primaryKey(col.int()) });
    const pivotTable = defineTable('user_roles', {
      id: col.primaryKey(col.int()),
      user_id: col.int(),
      role_id: col.int()
    });
    const processor = new RelationChangeProcessor(unit as any, dialect, executor);

    const root = { id: 1 };
    const role = { id: 7 };

    const attach: RelationChangeEntry = {
      root,
      relationKey: 'users.roles',
      rootTable,
      relationName: 'roles',
      relation: belongsToMany(targetTable, pivotTable, {
        pivotForeignKeyToRoot: 'user_id',
        pivotForeignKeyToTarget: 'role_id',
        cascade: 'remove'
      }),
      change: { kind: 'attach', entity: role }
    };

    processor.registerChange(attach);
    await processor.process();
    expect(executed[0].sql).toContain('INSERT INTO "user_roles"');

    const detach = { ...attach, change: { kind: 'detach', entity: role } } as RelationChangeEntry;
    processor.registerChange(detach);
    await processor.process();
    expect(executed[1].sql).toContain('DELETE FROM "user_roles"');
    expect(unit.markRemoved).toHaveBeenCalledWith(role);
  });
});

class UserRegisteredEvent {
  readonly type = 'UserRegistered' as const;

  constructor(public readonly id: number) { }
}

type BusContext = { requestId: string };

type DomainEvents = { type: 'UserCreated'; userId: number } | UserRegisteredEvent;

describe('DomainEventBus', () => {
  it('dispatches and clears domain events', async () => {
    const handler = vi.fn<(event: Extract<DomainEvents, { type: 'UserCreated' }>, ctx: BusContext) => void>();
    const bus = new DomainEventBus<DomainEvents, BusContext>({
      UserCreated: [handler]
    });
    const entity: HasDomainEvents<DomainEvents> = { domainEvents: [] };
    const event: Extract<DomainEvents, { type: 'UserCreated' }> = { type: 'UserCreated', userId: 1 };
    addDomainEvent(entity, event);

    await bus.dispatch([{ entity } as TrackedEntity], { requestId: 'req-1' });

    expect(handler).toHaveBeenCalledWith(event, { requestId: 'req-1' });
    expect(entity.domainEvents).toEqual([]);
  });

  it('routes handlers by event type even for class-based events', async () => {
    const handler = vi.fn<(event: Extract<DomainEvents, { type: 'UserRegistered' }>, ctx: BusContext) => void>();
    const bus = new DomainEventBus<DomainEvents, BusContext>({
      UserRegistered: [handler]
    });
    const entity: HasDomainEvents<DomainEvents> = { domainEvents: [new UserRegisteredEvent(1)] };

    await bus.dispatch([{ entity } as TrackedEntity], { requestId: 'req-2' });

    expect(handler).toHaveBeenCalledWith(expect.any(UserRegisteredEvent), { requestId: 'req-2' });
    expect(entity.domainEvents).toEqual([]);
  });
});
