import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { insertInto, selectFrom } from '../../src/query/index.js';
import { eq } from '../../src/core/ast/expression.js';

const REQUIRED_ENV = ['PGE_DIGITAL_HOST', 'PGE_DIGITAL_USER', 'PGE_DIGITAL_PASSWORD'] as const;
const hasMssqlEnv = REQUIRED_ENV.every(name => !!process.env[name]);
const describeMssql = hasMssqlEnv ? describe : describe.skip;

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const randomTempTableName = (): string =>
  `##upsert_mssql_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

describeMssql('Upsert e2e (mssql temp table)', () => {
  let connection: Connection;
  let session: OrmSession;

  beforeAll(async () => {
    const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;
    const database = process.env.PGE_DIGITAL_DATABASE ?? 'PGE_DIGITAL';
    const encrypt = parseBool(process.env.PGE_DIGITAL_ENCRYPT, true);
    const trustServerCertificate = parseBool(process.env.PGE_DIGITAL_TRUST_CERT, true);
    const port = Number(process.env.PGE_DIGITAL_PORT ?? '1433');

    connection = await new Promise<Connection>((resolve, reject) => {
      const conn = new Connection({
        server: PGE_DIGITAL_HOST!,
        authentication: {
          type: 'default',
          options: {
            userName: PGE_DIGITAL_USER!,
            password: PGE_DIGITAL_PASSWORD!
          }
        },
        options: {
          database,
          encrypt,
          trustServerCertificate,
          port: Number.isFinite(port) ? port : 1433
        }
      });

      conn.on('connect', err => (err ? reject(err) : resolve(conn)));
      conn.connect();
    });

    const executor = createTediousExecutor(connection, { Request, TYPES });
    const orm = new Orm({
      dialect: new SqlServerDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {}
      }
    });

    session = new OrmSession({ orm, executor });
  }, 30_000);

  afterAll(() => {
    connection?.close();
  });

  it('updates existing row with onConflict(...).doUpdate(...)', async () => {
    const tableName = randomTempTableName();
    const users = defineTable(tableName, {
      id: col.primaryKey(col.int()),
      email: col.unique(col.varchar(255)),
      name: col.varchar(255)
    });

    try {
      await session.executor.executeSql(`
        CREATE TABLE [${tableName}] (
          [id] INT NOT NULL PRIMARY KEY,
          [email] NVARCHAR(255) NOT NULL UNIQUE,
          [name] NVARCHAR(255) NOT NULL
        );
      `);

      const firstInsert = insertInto(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice' })
        .compile('mssql');
      await session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(users)
        .values({ id: 1, email: 'alice@example.com', name: 'Alice 2' })
        .onConflict([users.columns.id])
        .doUpdate({ name: 'Alice Updated' })
        .compile('mssql');
      await session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(users)
        .select({
          id: users.columns.id,
          email: users.columns.email,
          name: users.columns.name
        })
        .where(eq(users.columns.id, 1))
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice Updated'
      });
    } finally {
      await session.executor.executeSql(`IF OBJECT_ID('tempdb..${tableName}') IS NOT NULL DROP TABLE [${tableName}];`);
    }
  }, 30_000);

  it('keeps existing row with onConflict(...).doNothing()', async () => {
    const tableName = randomTempTableName();
    const users = defineTable(tableName, {
      id: col.primaryKey(col.int()),
      email: col.unique(col.varchar(255)),
      name: col.varchar(255)
    });

    try {
      await session.executor.executeSql(`
        CREATE TABLE [${tableName}] (
          [id] INT NOT NULL PRIMARY KEY,
          [email] NVARCHAR(255) NOT NULL UNIQUE,
          [name] NVARCHAR(255) NOT NULL
        );
      `);

      const firstInsert = insertInto(users)
        .values({ id: 2, email: 'bob@example.com', name: 'Bob' })
        .compile('mssql');
      await session.executor.executeSql(firstInsert.sql, firstInsert.params);

      const upsert = insertInto(users)
        .values({ id: 2, email: 'bob@example.com', name: 'Should Be Ignored' })
        .onConflict([users.columns.id])
        .doNothing()
        .compile('mssql');
      await session.executor.executeSql(upsert.sql, upsert.params);

      const rows = await selectFrom(users)
        .select({
          id: users.columns.id,
          email: users.columns.email,
          name: users.columns.name
        })
        .where(eq(users.columns.id, 2))
        .execute(session);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: 2,
        email: 'bob@example.com',
        name: 'Bob'
      });
    } finally {
      await session.executor.executeSql(`IF OBJECT_ID('tempdb..${tableName}') IS NOT NULL DROP TABLE [${tableName}];`);
    }
  }, 30_000);
});
