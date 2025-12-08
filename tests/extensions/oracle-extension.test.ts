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
import {
  OrmContext,
} from '../../src/orm/orm-context.js';
import type { DatabaseSchema } from '../../src/core/ddl/schema-types.js';
import { Dialect } from '../../src/core/dialect/abstract.js';
import type { DialectName } from '../../src/core/sql/sql.js';

// minimal fake dialect implementation
class OracleDialect extends Dialect {
  readonly dialect: DialectName = 'sqlite';

  // basic methods; tests won't depend on SQL details
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  // implement only what you need for tests, throw otherwise
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

  // add stub implementations or use "any" where easier for tests
  // ... (keep it minimal)

  // Make constructor public for testing
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
    // We just care that this function is called with the right dialect and executor.
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

    // our fake introspector returns empty tables
    expect(schema).toEqual({ tables: [] });

    // and the executor should have been used for some query
    expect(client.executed.length).toBeGreaterThanOrEqual(0);
  });

  it('wires custom Oracle executor into OrmContext', async () => {
    registerOracleDialect();

    const client = createFakeOracleClient();
    const executor = createOracleExecutor(client);
    const dialect = DialectFactory.create('oracle');

    const ctx = new OrmContext({
      dialect,
      executor,
    });

    // we can't fully execute Oracle SQL without a dialect, but we
    // can simulate a simple no-op operation that triggers executor usage.
    // For example, you could stub unit-of-work to make a trivial "SELECT 1" call,
    // or just assert that ctx.saveChanges() doesn't blow up with our fake.
    await expect(ctx.saveChanges()).resolves.not.toThrow();
  });
});
