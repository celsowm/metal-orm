import type { DbExecutor, QueryResult } from '../core/execution/db-executor.js';
import { rowsToQueryResult } from '../core/execution/db-executor.js';
import type { Pool } from '../core/execution/pooling/pool.js';
import type { DbExecutorFactory } from './orm.js';

export interface PooledConnectionAdapter<TConn> {
    query(
        conn: TConn,
        sql: string,
        params?: unknown[]
    ): Promise<Array<Record<string, unknown>>>;

    beginTransaction(conn: TConn): Promise<void>;
    commitTransaction(conn: TConn): Promise<void>;
    rollbackTransaction(conn: TConn): Promise<void>;
}

type PooledExecutorFactoryOptions<TConn> = {
    pool: Pool<TConn>;
    adapter: PooledConnectionAdapter<TConn>;
};

/**
 * Creates a first-class DbExecutorFactory backed by MetalORM's Pool.
 *
 * Design goals:
 * - No leaks by default: pool leases are always released in `finally`.
 * - Correct transactions: one leased connection per transaction.
 * - Session-friendly: createExecutor() supports transactions without permanently leasing a connection.
 */
export function createPooledExecutorFactory<TConn>(
    opts: PooledExecutorFactoryOptions<TConn>
): DbExecutorFactory {
    const { pool, adapter } = opts;

    const makeExecutor = (mode: 'session' | 'sticky'): DbExecutor => {
        let lease: Awaited<ReturnType<typeof pool.acquire>> | null = null;

        const getLease = async () => {
            if (lease) return lease;
            lease = await pool.acquire();
            return lease;
        };

        const executeWithConn = async (
            conn: TConn,
            sql: string,
            params?: unknown[]
        ): Promise<QueryResult[]> => {
            const rows = await adapter.query(conn, sql, params);
            return [rowsToQueryResult(rows)];
        };

        return {
            capabilities: { transactions: true },

            async executeSql(sql, params) {
                // Sticky mode: always reuse a leased connection.
                if (mode === 'sticky') {
                    const l = await getLease();
                    return executeWithConn(l.resource, sql, params);
                }

                // Session mode: use the leased connection if we're currently in a transaction;
                // otherwise acquire/release per call.
                if (lease) {
                    return executeWithConn(lease.resource, sql, params);
                }

                const l = await pool.acquire();
                try {
                    return await executeWithConn(l.resource, sql, params);
                } finally {
                    await l.release();
                }
            },

            async beginTransaction() {
                const l = await getLease();
                await adapter.beginTransaction(l.resource);
            },

            async commitTransaction() {
                if (!lease) {
                    throw new Error('commitTransaction called without an active transaction');
                }
                const l = lease;
                try {
                    await adapter.commitTransaction(l.resource);
                } finally {
                    lease = null;
                    await l.release();
                }
            },

            async rollbackTransaction() {
                if (!lease) {
                    // Nothing to rollback; keep idempotent semantics.
                    return;
                }
                const l = lease;
                try {
                    await adapter.rollbackTransaction(l.resource);
                } finally {
                    lease = null;
                    await l.release();
                }
            },

            async dispose() {
                if (!lease) return;
                const l = lease;
                lease = null;
                await l.release();
            },
        };
    };

    return {
        createExecutor() {
            return makeExecutor('session');
        },
        createTransactionalExecutor() {
            return makeExecutor('sticky');
        },
        async dispose() {
            await pool.destroy();
        },
    };
}

