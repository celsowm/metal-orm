import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { Orm } from '../../../src/orm/orm.js';
import { OrmSession } from '../../../src/orm/orm-session.js';
import { col } from '../../../src/schema/column-types.js';
import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
} from '../../../src/decorators/index.js';

@Entity({ tableName: 'repro_identity_test' })
class ReproIdentity {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  name?: string;
}

const REQUIRED_ENV = ['PGE_DIGITAL_HOST', 'PGE_DIGITAL_USER', 'PGE_DIGITAL_PASSWORD'] as const;
const hasDbEnv = REQUIRED_ENV.every((name) => !!process.env[name]);
const describeDb = hasDbEnv ? describe : describe.skip;

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

describeDb('MSSQL Identity Retrieval Repro', () => {
  let connection: Connection;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();

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
            password: PGE_DIGITAL_PASSWORD!,
          },
        },
        options: {
          database,
          encrypt,
          trustServerCertificate,
          port: Number.isFinite(port) ? port : 1433,
          connectTimeout: 30000,
        },
      });

      conn.on('connect', (err) => (err ? reject(err) : resolve(conn)));
      conn.connect();
    });

    const executor = createTediousExecutor(connection, { Request, TYPES });
    
    // Create table for test
    try {
      await executor.executeSql(`
        IF OBJECT_ID('repro_identity_test', 'U') IS NOT NULL
          DROP TABLE repro_identity_test;
        CREATE TABLE repro_identity_test (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name VARCHAR(255)
        );
      `, []);
    } catch (e) {
      console.warn('Failed to create test table, it might already exist or permission denied:', e);
    }

    const orm = new Orm({
      dialect: new SqlServerDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => { },
      },
    });
    session = new OrmSession({ orm, executor });
  });

  afterAll(async () => {
    if (connection) {
      const executor = createTediousExecutor(connection, { Request, TYPES });
      try {
        await executor.executeSql("IF OBJECT_ID('repro_identity_test', 'U') IS NOT NULL DROP TABLE repro_identity_test;", []);
      } catch (e) {
        // ignore
      }
      connection.close();
    }
  });

  it('should automatically populate the ID after flush (expected to fail currently)', async () => {
    const entity = new ReproIdentity();
    entity.name = 'Test Identity';

    await session.persist(entity);
    await session.flush();

    console.log('Entity after flush:', entity);
    
    // This is what the user says is currently undefined
    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });
});
