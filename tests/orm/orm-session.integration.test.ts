import { describe, expect, it, vi } from 'vitest';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import type { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import type { OrmSessionOptions } from '../../src/orm/orm-session.js';
import { addDomainEvent } from '../../src/orm/domain-event-bus.js';
import type { HasDomainEvents } from '../../src/orm/runtime-types.js';
import { Users } from '../fixtures/schema.js';

type UserDomainEvent = {
    type: 'UserPersisted';
    userId: number;
};

const createMockExecutor = (options?: { savepoints?: boolean }) => {
    const supportsSavepoints = options?.savepoints ?? true;
    const beginTransaction = vi.fn(async () => { });
    const commitTransaction = vi.fn(async () => { });
    const rollbackTransaction = vi.fn(async () => { });
    const savepoint = vi.fn(async (_name: string) => { });
    const releaseSavepoint = vi.fn(async (_name: string) => { });
    const rollbackToSavepoint = vi.fn(async (_name: string) => { });
    const executor: DbExecutor = {
        capabilities: {
            transactions: true,
            ...(supportsSavepoints ? { savepoints: true } : {}),
        },
        async executeSql() {
            return [] as QueryResult[];
        },
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        ...(supportsSavepoints
            ? {
                savepoint,
                releaseSavepoint,
                rollbackToSavepoint,
            }
            : {}),
        dispose: vi.fn(async () => { })
    };
    return {
        executor,
        beginTransaction,
        commitTransaction,
        rollbackTransaction,
        savepoint,
        releaseSavepoint,
        rollbackToSavepoint,
    };
};

const createSession = (
    executor: DbExecutor,
    extraOptions?: Pick<OrmSessionOptions, 'interceptors' | 'domainEventHandlers'>
): OrmSession => {
    const factory = {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => { }
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
        const handler = vi.fn<(event: UserDomainEvent, ctx: OrmSession) => void>();

        session.registerDomainEventHandler('UserPersisted', handler);

        const user: HasDomainEvents<UserDomainEvent> & {
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

        const persistedEvent: UserDomainEvent = { type: 'UserPersisted', userId: user.id };
        addDomainEvent(user, persistedEvent);

        await session.commit();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(persistedEvent, session);
        expect(user.domainEvents).toEqual([]);
    });

    it('wraps transaction helper with begin/commit', async () => {
        const { executor, beginTransaction, commitTransaction, rollbackTransaction } = createMockExecutor();
        const session = createSession(executor);

        await session.transaction(async () => {
            // simulate some no-op work
            return 42;
        });

        expect(beginTransaction).toHaveBeenCalledTimes(1);
        expect(commitTransaction).toHaveBeenCalledTimes(1);
        expect(rollbackTransaction).not.toHaveBeenCalled();
    });

    it('rolls back transaction helper on error', async () => {
        const { executor, beginTransaction, commitTransaction, rollbackTransaction } = createMockExecutor();
        const session = createSession(executor);

        await expect(session.transaction(async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        expect(beginTransaction).toHaveBeenCalledTimes(1);
        expect(commitTransaction).not.toHaveBeenCalled();
        expect(rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('uses savepoints for nested session.transaction calls', async () => {
        const {
            executor,
            beginTransaction,
            commitTransaction,
            rollbackTransaction,
            savepoint,
            releaseSavepoint,
            rollbackToSavepoint,
        } = createMockExecutor({ savepoints: true });
        const session = createSession(executor);

        await session.transaction(async () => {
            return session.transaction(async () => 123);
        });

        expect(beginTransaction).toHaveBeenCalledTimes(1);
        expect(savepoint).toHaveBeenCalledTimes(1);
        expect(releaseSavepoint).toHaveBeenCalledTimes(1);
        expect(rollbackToSavepoint).not.toHaveBeenCalled();
        expect(commitTransaction).toHaveBeenCalledTimes(1);
        expect(rollbackTransaction).not.toHaveBeenCalled();
    });

    it('marks outer transaction as rollback-only when inner transaction fails', async () => {
        const {
            executor,
            beginTransaction,
            commitTransaction,
            rollbackTransaction,
            savepoint,
            releaseSavepoint,
            rollbackToSavepoint,
        } = createMockExecutor({ savepoints: true });
        const session = createSession(executor);

        await expect(session.transaction(async () => {
            await expect(session.transaction(async () => {
                throw new Error('inner-failed');
            })).rejects.toThrow('inner-failed');
        })).rejects.toThrow('Cannot commit transaction because an inner transaction failed');

        expect(beginTransaction).toHaveBeenCalledTimes(1);
        expect(savepoint).toHaveBeenCalledTimes(1);
        expect(rollbackToSavepoint).toHaveBeenCalledTimes(1);
        expect(releaseSavepoint).not.toHaveBeenCalled();
        expect(commitTransaction).not.toHaveBeenCalled();
        expect(rollbackTransaction).toHaveBeenCalledTimes(1);
    });

    it('dispatches domain events only on the outermost transaction commit', async () => {
        const { executor, commitTransaction } = createMockExecutor({ savepoints: true });
        const session = createSession(executor);
        const commitCountAtDispatch: number[] = [];

        session.registerDomainEventHandler('UserPersisted', () => {
            commitCountAtDispatch.push(commitTransaction.mock.calls.length);
        });

        const user: HasDomainEvents<UserDomainEvent> & {
            id: number;
            name: string;
            role: string;
            settings: string;
            deleted_at: string | null;
        } = {
            id: 2,
            name: 'Nested Event',
            role: 'admin',
            settings: '{}',
            deleted_at: null,
            domainEvents: []
        };
        session.trackManaged(Users, user.id, user);
        addDomainEvent(user, { type: 'UserPersisted', userId: user.id });

        await session.transaction(async () => {
            await session.transaction(async () => { });
        });

        expect(commitCountAtDispatch).toEqual([1]);
    });

    it('fails deterministically when nested transactions are used without savepoint support', async () => {
        const {
            executor,
            beginTransaction,
            commitTransaction,
            rollbackTransaction,
        } = createMockExecutor({ savepoints: false });
        const session = createSession(executor);

        await expect(session.transaction(async () => {
            await session.transaction(async () => 1);
        })).rejects.toThrow('Nested session.transaction calls require savepoint support in this executor');

        expect(beginTransaction).toHaveBeenCalledTimes(1);
        expect(commitTransaction).not.toHaveBeenCalled();
        expect(rollbackTransaction).toHaveBeenCalledTimes(1);
    });
});
