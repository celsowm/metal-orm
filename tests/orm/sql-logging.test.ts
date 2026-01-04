import { describe, it, expect, vi } from 'vitest';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { DbExecutor, QueryResult } from '../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { Orm } from '../../src/orm/orm.js';
import { InterceptorPipeline, QueryContext } from '../../src/orm/interceptor-pipeline.js';
import { eq } from '../../src/core/ast/expression.js';

const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.text()
});

class MockExecutor implements DbExecutor {
    readonly capabilities = { transactions: true };
    async executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]> {
        return [{ columns: [], values: [] }];
    }
    async beginTransaction() { }
    async commitTransaction() { }
    async rollbackTransaction() { }
    async dispose() { }
}

describe('SQL Logging and Retrieval', () => {
    const dialect = new SqliteDialect();
    const executor = new MockExecutor();
    const orm = new Orm({
        dialect,
        executorFactory: {
            createExecutor: () => executor,
            createTransactionalExecutor: () => executor,
            dispose: async () => { }
        }
    });

    describe('Manual Retrieval', () => {
        it('should return SQL string using .toSql()', () => {
            const qb = new SelectQueryBuilder(Users).where(eq(Users.columns.id, 1));
            const sql = qb.toSql(dialect);
            expect(sql).toContain('SELECT');
            expect(sql).toContain('"users"');
            expect(sql).toContain('"id" = ?');
        });

        it('should return CompiledQuery using .compile()', () => {
            const qb = new SelectQueryBuilder(Users).where(eq(Users.columns.id, 42));
            const compiled = qb.compile(dialect);
            expect(compiled.sql).toContain('"id" = ?');
            expect(compiled.params).toEqual([42]);
        });
    });

    describe('Runtime Logging', () => {
        it('should call queryLogger when executing a query', async () => {
            const logger = vi.fn();
            const session = new OrmSession({ orm, executor, queryLogger: logger });
            const qb = new SelectQueryBuilder(Users).where(eq(Users.columns.id, 1));

            await session.findMany(qb);

            expect(logger).toHaveBeenCalled();
            const entry = logger.mock.calls[0][0];
            expect(entry.sql).toContain('SELECT');
            expect(entry.params).toEqual([1]);
        });
    });

    describe('Interceptors', () => {
        it('should trigger interceptors on query execution', async () => {
            const interceptor = vi.fn(async (ctx: QueryContext, next: () => Promise<QueryResult[]>) => {
                return next();
            });

            const customOrm = new Orm({
                dialect,
                executorFactory: {
                    createExecutor: () => executor,
                    createTransactionalExecutor: () => executor,
                    dispose: async () => { }
                },
                interceptors: new InterceptorPipeline()
            });
            customOrm.interceptors.use(interceptor);

            const session = customOrm.createSession();
            const qb = new SelectQueryBuilder(Users).where(eq(Users.columns.id, 99));

            await session.findMany(qb);

            expect(interceptor).toHaveBeenCalled();
            const ctx = interceptor.mock.calls[0][0];
            expect(ctx.sql).toContain('SELECT');
            expect(ctx.params).toEqual([99]);
        });
    });
});
