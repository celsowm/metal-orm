import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';

import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { Orm } from '../../../src/orm/orm.js';
import { OrmSession } from '../../../src/orm/orm-session.js';
import { col } from '../../../src/schema/column-types.js';
import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
} from '../../../src/decorators/index.js';
import {
  createMysqlExecutor,
  type MysqlClientLike,
} from '../../../src/core/execution/executors/mysql-executor.js';
import { createDB } from 'mysql-memory-server';

@Entity({ tableName: 'repro_identity_test' })
class ReproIdentity {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  name?: string;
}

const createMysqlClient = (connection: mysql.Connection): MysqlClientLike => ({
  async query(sql, params) {
    const [rows] = await connection.execute(sql, params ?? []);
    return [rows, undefined];
  },
});

describe('MySQL Identity Retrieval Repro', () => {
  let db: any;
  let connection: mysql.Connection;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();

    db = await createDB({
      logLevel: (process.env.MYSQL_MEMORY_SERVER_LOG_LEVEL as any) || 'ERROR',
      version: '9.5.0',
    });

    connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: db.username,
      port: db.port,
      database: db.dbName,
      password: '',
    });

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS repro_identity_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255)
      )
    `);

    const executor = createMysqlExecutor(createMysqlClient(connection));

    const orm = new Orm({
      dialect: new MySqlDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {},
      },
    });
    session = new OrmSession({ orm, executor });
  }, 60_000);

  afterAll(async () => {
    if (connection) {
      try {
        await connection.execute('DROP TABLE IF EXISTS repro_identity_test');
      } catch (e) {
        // ignore
      }
      await connection.end();
    }
    if (db) {
      await db.stop();
    }
  });

  it('should automatically populate the ID after flush (expected to fail currently)', async () => {
    const entity = new ReproIdentity();
    entity.name = 'Test Identity';

    await session.persist(entity);
    await session.flush();

    console.log('Entity after flush:', entity);

    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });
});
