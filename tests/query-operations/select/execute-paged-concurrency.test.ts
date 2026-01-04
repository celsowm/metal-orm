import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { OrmSession } from '../../../src/orm/orm-session.js';
import { DbExecutor, QueryResult } from '../../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { Orm } from '../../../src/orm/orm.js';

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

describe('executePaged concurrency', () => {
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
