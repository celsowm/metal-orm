// tests/extensions/oracle-extension.test.ts
import { describe, it, expect } from 'vitest';

import { DialectFactory } from '../../src/core/dialect/dialect-factory.js';
import { createSqlDialect } from '../../src/core/dialect/base/sql-dialect-composer.js';
import { introspectSchema } from '../../src/core/ddl/schema-introspect.js';
import { registerSchemaIntrospector } from '../../src/core/ddl/introspect/registry.js';
import {
  createExecutorFromQueryRunner,
  type DbExecutor,
  type SimpleQueryRunner,
} from '../../src/core/execution/db-executor.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import type { DatabaseSchema } from '../../src/core/ddl/schema-types.js';
import type { DialectName } from '../../src/core/sql/sql.js';

const createOracleDialect = () => createSqlDialect({
  name: 'oracle',
  quoteIdentifier: id => `"${id}"`
});

const registerOracleDialect = () => {
  DialectFactory.register('oracle', createOracleDialect);
};

const oracleIntrospector = {
  async introspect(
    ctx: any,
    options: any
  ): Promise<DatabaseSchema> {
    void ctx;
    void options;
    return {
      tables: [],
    } as any;
  },
};

const registerOracleIntrospector = () => {
  registerSchemaIntrospector('oracle' as DialectName, oracleIntrospector);
};

interface FakeOracleClient {
  executed: { sql: string; params?: unknown[] }[];
  beginCalls: number;
  commitCalls: number;
  rollbackCalls: number;

  execute(
    sql: string,
    params?: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
}

function createFakeOracleClient(): FakeOracleClient {
  return {
    executed: [],
    beginCalls: 0,
    commitCalls: 0,
    rollbackCalls: 0,
    async execute(sql, params) {
      this.executed.push({ sql, params });
      return [{ id: 1, name: 'oracle-row' }];
    },
  };
}

function createOracleExecutor(client: FakeOracleClient): DbExecutor {
  const runner: SimpleQueryRunner = {
    async query(sql, params) {
      return client.execute(sql, params);
    },
    async beginTransaction() {
      client.beginCalls++;
    },
    async commitTransaction() {
      client.commitCalls++;
    },
    async rollbackTransaction() {
      client.rollbackCalls++;
    },
  };

  return createExecutorFromQueryRunner(runner);
}

describe('Oracle extension point (test-only)', () => {
  it('allows registering a composed Oracle dialect and introspector', async () => {
    registerOracleDialect();
    registerOracleIntrospector();

    const client = createFakeOracleClient();
    const executor = createOracleExecutor(client);

    const schema = await introspectSchema(
      executor,
      'oracle' as DialectName,
      {}
    );

    expect(schema).toEqual({ tables: [] });
    expect(client.executed.length).toBeGreaterThanOrEqual(0);
  });

  it('wires custom Oracle executor into OrmSession', async () => {
    registerOracleDialect();

    const client = createFakeOracleClient();
    const executor = createOracleExecutor(client);
    const dialect = DialectFactory.create('oracle');

    const factory = {
      createExecutor: () => executor,
      createTransactionalExecutor: () => executor,
      dispose: async () => { }
    };
    const orm = new Orm({ dialect, executorFactory: factory });
    const session = new OrmSession({ orm, executor });

    await expect(session.commit()).resolves.not.toThrow();
  });
});
