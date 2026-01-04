import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { OrmSession } from '../../../src/orm/orm-session.js';
import { DbExecutor, QueryResult } from '../../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { Orm } from '../../../src/orm/orm.js';
import { Connection, Request, TYPES } from 'tedious';
import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';

const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.text()
});

class ConcurrencyCheckingExecutor implements DbExecutor {
    private isBusy = false;
    readonly capabilities = { transactions: false };

    async executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]> {
        if (this.isBusy) {
            throw new Error('EINVALIDSTATE: Connection is busy with another request');
        }
        this.isBusy = true;
        try {
            // Simulate some delay to increase chance of overlap if executed in parallel
            await new Promise(resolve => setTimeout(resolve, 50));
            // Return dummy data to satisfy the query
            if (sql.includes('COUNT')) {
                return [{ columns: ['total'], values: [[50]] }];
            }
            return [{ columns: ['id', 'name'], values: [[1, 'Alice']] }];
        } finally {
            this.isBusy = false;
        }
    }

    async beginTransaction() { }
    async commitTransaction() { }
    async rollbackTransaction() { }
    async dispose() { }
}

describe('executePaged concurrency (SQLite Mock)', () => {
    it('should execute queries sequentially to avoid EINVALIDSTATE', async () => {
        const executor = new ConcurrencyCheckingExecutor();
        const orm = new Orm({
            dialect: new SqliteDialect(),
            executorFactory: {
                createExecutor: () => executor,
                createTransactionalExecutor: () => executor,
                dispose: async () => { }
            }
        });
        const session = new OrmSession({ orm, executor });

        const query = new SelectQueryBuilder(Users);

        // This should now succeed because queries are executed sequentially
        const result = await query.executePaged(session, { page: 1, pageSize: 10 });

        expect(result.items).toHaveLength(1);
        expect(result.totalItems).toBe(50);
    });
});

const hasMssqlEnv =
    !!process.env.PGE_DIGITAL_HOST &&
    !!process.env.PGE_DIGITAL_USER &&
    !!process.env.PGE_DIGITAL_PASSWORD;

const maybeMssql = hasMssqlEnv ? describe : describe.skip;

maybeMssql('executePaged with real MSSQL (tedious)', () => {
    let connection: Connection;

    beforeAll(async () => {
        const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;
        const config = {
            server: PGE_DIGITAL_HOST!,
            authentication: {
                type: 'default' as const,
                options: {
                    userName: PGE_DIGITAL_USER!,
                    password: PGE_DIGITAL_PASSWORD!
                }
            },
            options: {
                encrypt: true,
                trustServerCertificate: true,
                database: 'PGE_DIGITAL',
                connectTimeout: 15000
            }
        };

        connection = new Connection(config);
        await new Promise<void>((resolve, reject) => {
            connection.on('connect', (err) => {
                if (err) reject(err);
                else resolve();
            });
            connection.connect();
        });
    });

    afterAll(() => {
        connection?.close();
    });

    it('successfully executes paged query against MSSQL', async () => {
        const executor = createTediousExecutor(connection, { Request, TYPES });

        // Use a regular table for isolation
        const TempUsers = defineTable('temp_paged_test_table', {
            id: col.primaryKey(col.int()),
            name: col.text()
        });

        const orm = new Orm({
            dialect: new SqlServerDialect(),
            executorFactory: {
                createExecutor: () => executor,
                createTransactionalExecutor: () => executor,
                dispose: async () => { }
            }
        });

        const session = new OrmSession({ orm, executor });

        // Setup data
        await executor.executeSql(`IF OBJECT_ID('temp_paged_test_table') IS NOT NULL DROP TABLE temp_paged_test_table`);
        await executor.executeSql(`CREATE TABLE temp_paged_test_table (id INT PRIMARY KEY, name NVARCHAR(100))`);
        await executor.executeSql(`INSERT INTO temp_paged_test_table (id, name) VALUES (1, 'SqlUser1'), (2, 'SqlUser2'), (3, 'SqlUser3')`);

        try {
            const query = new SelectQueryBuilder(TempUsers).orderBy(TempUsers.columns.id);
            const result = await query.executePaged(session, { page: 1, pageSize: 2 });

            expect(result.items).toHaveLength(2);
            expect(result.totalItems).toBe(3);
            expect(result.items[0].name).toBe('SqlUser1');
            expect(result.items[1].name).toBe('SqlUser2');
        } finally {
            await executor.executeSql(`IF OBJECT_ID('temp_paged_test_table') IS NOT NULL DROP TABLE temp_paged_test_table`);
        }
    });
});
