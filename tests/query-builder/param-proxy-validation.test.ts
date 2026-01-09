import { describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { InterceptorPipeline } from '../../src/orm/interceptor-pipeline.js';
import type { DbExecutor } from '../../src/core/execution/db-executor.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { selectFrom } from '../../src/query/index.js';
import { createParamProxy, eq } from '../../src/core/ast/expression.js';

const users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255)
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  userId: col.int(),
  title: col.varchar(255)
});

const createSession = () => {
  const intercepted: string[] = [];
  const executed: string[] = [];

  const interceptors = new InterceptorPipeline();
  interceptors.use(async (ctx, next) => {
    intercepted.push(ctx.sql);
    return next();
  });

  const executor: DbExecutor = {
    capabilities: { transactions: false },
    async executeSql(sql) {
      executed.push(sql);
      if (sql.includes('COUNT(')) {
        return [{ columns: ['total'], values: [[3]] }];
      }
      if (sql.toUpperCase().startsWith('SELECT')) {
        return [{ columns: ['id', 'name', 'email'], values: [[1, 'John', 'john@example.com']] }];
      }
      return [{ columns: [], values: [] }];
    },
    beginTransaction: async () => { },
    commitTransaction: async () => { },
    rollbackTransaction: async () => { },
    dispose: async () => { }
  };

  const orm = new Orm({ dialect: new SqliteDialect(), executorFactory: { 
    createExecutor: () => executor,
    createTransactionalExecutor: () => executor,
    dispose: async () => { }
  } });
  const session = new OrmSession({ orm, executor, interceptors: [] });

  return { session, intercepted, executed };
};

const expectParamGuard = async (qb: { execute: (session: OrmSession) => Promise<unknown> }) => {
  const { session } = createSession();
  await expect(qb.execute(session)).rejects.toThrow('Cannot execute query containing Param operands');
};

describe('Param proxy validation', () => {
  // Note: Param proxies work correctly for getSchema() but have limitations
  // in other contexts. These tests document current behavior.

  it('should allow getSchema() with Param operands', () => {
    const p = createParamProxy();
    const qb = selectFrom(users)
      .where(eq(users.columns.name, p.filter.name));

    const { parameters } = qb.getSchema();

    expect(parameters).toBeDefined();
    expect(parameters?.length).toBeGreaterThan(0);
  });

  it('should allow normal queries without Param operands', async () => {
    const { session } = createSession();
    const qb = selectFrom(users)
      .where(eq(users.columns.name, 'John'));

    const sql = qb.compile(new SqliteDialect()).sql;
    expect(sql).toContain('WHERE');

    const getSchema = () => qb.getSchema();
    expect(getSchema).not.toThrow();
  });

  it('should allow compiling normal queries without Param operands', () => {
    const dialect = new SqliteDialect();
    const qb = selectFrom(users)
      .where(eq(users.columns.name, 'John'));

    const compiled = qb.compile(dialect);
    expect(compiled.sql).toContain('WHERE');
    expect(compiled.params).toContain('John');
  });

  it('should allow compiling with allowParams option', () => {
    const dialect = new SqliteDialect();
    const p = createParamProxy();
    const qb = selectFrom(users)
      .where(eq(users.columns.name, p.filter.name));

    const compiled = dialect.compileSelectWithOptions(qb.getAST(), { allowParams: true });
    expect(compiled.sql).toContain('WHERE');
    expect(compiled.params).toContain(null);
  });

  it('should reject Param operands in join conditions', async () => {
    const p = createParamProxy();
    const qb = selectFrom(users)
      .innerJoin(posts, eq(users.columns.id, p.filter.userId));

    await expectParamGuard(qb);
  });

  it('should reject Param operands in groupBy terms', async () => {
    const p = createParamProxy();
    const qb = selectFrom(users)
      .select('id')
      .groupBy(p.filter.groupKey);

    await expectParamGuard(qb);
  });

  it('should reject Param operands inside CTE queries', async () => {
    const p = createParamProxy();
    const cteQuery = selectFrom(users)
      .select('id')
      .groupBy(p.filter.cteGroup);
    const qb = selectFrom(users)
      .with('user_cte', cteQuery);

    await expectParamGuard(qb);
  });

  it('should reject Param operands inside EXISTS subqueries', async () => {
    const p = createParamProxy();
    const subquery = selectFrom(posts)
      .where(eq(posts.columns.userId, p.filter.userId));
    const qb = selectFrom(users)
      .whereExists(subquery);

    await expectParamGuard(qb);
  });
});
