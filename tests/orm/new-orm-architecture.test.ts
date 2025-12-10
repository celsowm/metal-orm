import { describe, expect, it } from 'vitest';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { ExecutionContext } from '../../src/orm/execution-context.js';
import { HydrationContext } from '../../src/orm/hydration-context.js';
import { InterceptorPipeline } from '../../src/orm/interceptor-pipeline.js';
import { DefaultNamingStrategy } from '../../src/codegen/naming-strategy.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';

// Mock DbExecutorFactory
class MockDbExecutorFactory {
  createExecutor() {
    return {
      executeSql: async (sql: string, params?: unknown[]) => {
        return [{
          columns: ['id', 'name'],
          values: [[1, 'test']]
        }];
      }
    };
  }

  createTransactionalExecutor() {
    return this.createExecutor();
  }
}

describe('New ORM Architecture', () => {
  it('should create Orm instance with proper configuration', () => {
    const dialect = new SqliteDialect();
    const executorFactory = new MockDbExecutorFactory();
    const interceptorPipeline = new InterceptorPipeline();
    const namingStrategy = new DefaultNamingStrategy();

    const orm = new Orm({
      dialect,
      executorFactory,
      interceptors: interceptorPipeline,
      namingStrategy
    });

    expect(orm).toBeInstanceOf(Orm);
    expect(orm.dialect).toBe(dialect);
    expect(orm.interceptors).toBe(interceptorPipeline);
    expect(orm.namingStrategy).toBe(namingStrategy);
  });

  it('should create OrmSession from Orm', () => {
    const dialect = new SqliteDialect();
    const executorFactory = new MockDbExecutorFactory();
    const orm = new Orm({
      dialect,
      executorFactory
    });

    const session = orm.createSession();

    expect(session).toBeInstanceOf(OrmSession);
    expect(session.orm).toBe(orm);
    expect(session.executor).toBeDefined();
    expect(session.identityMap).toBeDefined();
    expect(session.unitOfWork).toBeDefined();
    expect(session.domainEvents).toBeDefined();
    expect(session.relationChanges).toBeDefined();
  });

  it('should provide ExecutionContext from OrmSession', () => {
    const dialect = new SqliteDialect();
    const executorFactory = new MockDbExecutorFactory();
    const orm = new Orm({
      dialect,
      executorFactory
    });

    const session = orm.createSession();
    const execCtx = session.getExecutionContext();

    expect(execCtx).toBeDefined();
    expect(execCtx.dialect).toBe(dialect);
    expect(execCtx.executor).toBeDefined();
    expect(execCtx.interceptors).toBeDefined();
  });

  it('should provide HydrationContext from OrmSession', () => {
    const dialect = new SqliteDialect();
    const executorFactory = new MockDbExecutorFactory();
    const orm = new Orm({
      dialect,
      executorFactory
    });

    const session = orm.createSession();
    const hydCtx = session.getHydrationContext();

    expect(hydCtx).toBeDefined();
    expect(hydCtx.identityMap).toBeDefined();
    expect(hydCtx.unitOfWork).toBeDefined();
    expect(hydCtx.domainEvents).toBeDefined();
    expect(hydCtx.relationChanges).toBeDefined();
  });

  it('should support transaction pattern', async () => {
    const dialect = new SqliteDialect();
    const executorFactory = new MockDbExecutorFactory();
    const orm = new Orm({
      dialect,
      executorFactory
    });

    let sessionUsedInTransaction: OrmSession | undefined;

    await orm.transaction(async (session) => {
      sessionUsedInTransaction = session;
      expect(session).toBeInstanceOf(OrmSession);
    });

    expect(sessionUsedInTransaction).toBeDefined();
  });
});
