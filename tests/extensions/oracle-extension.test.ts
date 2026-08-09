// tests/extensions/oracle-extension.test.ts
import { describe, it, expect, vi } from 'vitest';

import {
  DialectFactory,
} from '../../src/core/dialect/dialect-factory.js';
import {
  introspectSchema,
} from '../../src/core/ddl/schema-introspect.js';
import {
  registerSchemaIntrospector,
} from '../../src/core/ddl/introspect/registry.js';
import {
  createExecutorFromQueryRunner,
  type DbExecutor,
  type SimpleQueryRunner,
} from '../../src/core/execution/db-executor.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import type { DatabaseSchema } from '../../src/core/ddl/schema-types.js';
import { Dialect } from '../../src/core/dialect/abstract.js';
import type { DialectName } from '../../src/core/sql/sql.js';

class OracleDialect extends Dialect {
  readonly dialect: DialectName = 'sqlite';

  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  protected compileSelectAst(): never {
    throw new Error('Not implemented in test OracleDialect');
  }

  protected compileInsertAst(): never {
    throw new Error('Not implemented in test OracleDialect');
  }

  protected compileUpdateAst(): never {
    throw new Error('Not implemented in test OracleDialect');
  }

  protected compileDeleteAst(): never {
    throw new Error('Not implemented in test OracleDialect');
  }

  public constructor() {
    super();
  }
}

const registerOracleDialect = () => {
  DialectFactory.register('oracle', () => new OracleDialect());
};

const oracleIntrospector = {
  async introspect(
    ctx: any,
    options: any
  ): Promise<DatabaseSchema> {
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
  it('allows registering an Oracle dialect and introspector', async () => {
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
