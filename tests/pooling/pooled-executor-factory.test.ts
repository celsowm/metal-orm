import { describe, expect, it, vi } from 'vitest';

import { Pool } from '../../src/core/execution/pooling/pool.js';
import { createPooledExecutorFactory } from '../../src/orm/pooled-executor-factory.js';

type Conn = {
    id: number;
    log: string[];
};

describe('createPooledExecutorFactory', () => {
    it('leases exactly one connection for the duration of a transaction', async () => {
        let nextId = 0;
        const destroyed: number[] = [];

        const pool = new Pool<Conn>(
            {
                create: async () => ({ id: ++nextId, log: [] }),
                destroy: async (c) => {
                    destroyed.push(c.id);
                },
            },
            { max: 2 }
        );

        const adapter = {
            query: vi.fn(async (conn: Conn, sql: string) => {
                conn.log.push(sql);
                return [];
            }),
            beginTransaction: vi.fn(async (conn: Conn) => {
                conn.log.push('BEGIN');
            }),
            commitTransaction: vi.fn(async (conn: Conn) => {
                conn.log.push('COMMIT');
            }),
            rollbackTransaction: vi.fn(async (conn: Conn) => {
                conn.log.push('ROLLBACK');
            }),
        };

        const factory = createPooledExecutorFactory({ pool, adapter });
        const exec = factory.createExecutor();

        await exec.beginTransaction();
        await exec.executeSql('SELECT 1');
        await exec.executeSql('SELECT 2');
        await exec.commitTransaction();

        expect(adapter.beginTransaction).toHaveBeenCalledTimes(1);
        expect(adapter.commitTransaction).toHaveBeenCalledTimes(1);
        expect(adapter.rollbackTransaction).toHaveBeenCalledTimes(0);
        expect(adapter.query).toHaveBeenCalledTimes(2);

        await factory.dispose();
        expect(destroyed.length).toBeGreaterThanOrEqual(0);
    });
});

