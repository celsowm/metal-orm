import { describe, expect, it, vi } from 'vitest';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import type { DbExecutor, QueryResult } from '../src/core/execution/db-executor.js';
import { Orm } from '../src/orm/orm.js';
import { OrmSession } from '../src/orm/orm-session.js';
import type { OrmSessionOptions } from '../src/orm/orm-session.js';
import { addDomainEvent } from '../src/orm/domain-event-bus.js';
import type { HasDomainEvents } from '../src/orm/runtime-types.js';
import { Users } from './fixtures/schema.js';

const createMockExecutor = () => {
    const beginTransaction = vi.fn(async () => { });
    const commitTransaction = vi.fn(async () => { });
    const rollbackTransaction = vi.fn(async () => { });
    const executor: DbExecutor = {
        async executeSql() {
            return [] as QueryResult[];
        },
        beginTransaction,
        commitTransaction,
        rollbackTransaction
    };
    return { executor, beginTransaction, commitTransaction, rollbackTransaction };
};

const createSession = (
    executor: DbExecutor,
    extraOptions?: Pick<OrmSessionOptions, 'interceptors' | 'domainEventHandlers'>
): OrmSession => {
    const factory = {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor
    };
    const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: factory });
    return new OrmSession({ orm, executor, ...(extraOptions ?? {}) });
};

describe('OrmSession integration', () => {
    it('executes interceptors before and after flush', async () => {
        const { executor } = createMockExecutor();
        const callOrder: string[] = [];
        const session = createSession(executor, {
            interceptors: [
                {
                    beforeFlush: () => {
                        callOrder.push('beforeFlush');
                    }
                }
            ]
        });

        session.registerInterceptor({
            afterFlush: () => {
                callOrder.push('afterFlush');
            }
        });

        await session.commit();

        expect(callOrder).toEqual(['beforeFlush', 'afterFlush']);
    });

    it('dispatches domain events after commit and clears them', async () => {
        const { executor } = createMockExecutor();
        const session = createSession(executor);
        const handler = vi.fn();

        session.registerDomainEventHandler('UserPersisted', handler);

        const user: HasDomainEvents & {
            id: number;
            name: string;
            role: string;
            settings: string;
            deleted_at: string | null;
        } = {
            id: 1,
            name: 'Eventful',
            role: 'admin',
            settings: '{}',
            deleted_at: null,
            domainEvents: []
        };
        session.trackManaged(Users, user.id, user);

        addDomainEvent(user, 'UserPersisted');

        await session.commit();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('UserPersisted', session);
        expect(user.domainEvents).toEqual([]);
    });
});
