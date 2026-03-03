import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { col } from '../../../src/schema/column-types.js';
import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
} from '../../../src/decorators/index.js';
import {
  createMysqlServer,
  stopMysqlServer,
  runSql,
  type MysqlTestSetup
} from '../../e2e/mysql-helpers.js';

@Entity({ tableName: 'repro_identity_test' })
class ReproIdentity {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  name?: string;
}

describe('MySQL Identity Retrieval Repro', () => {
  let setup: MysqlTestSetup;

  beforeAll(async () => {
    bootstrapEntities();
    setup = await createMysqlServer();

    await runSql(setup.connection, 'DROP TABLE IF EXISTS repro_identity_test');
    await runSql(setup.connection, `
      CREATE TABLE repro_identity_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255)
      )
    `);
  }, 60_000);

  afterAll(async () => {
    if (setup) {
      try {
        await runSql(setup.connection, 'DROP TABLE IF EXISTS repro_identity_test');
      } catch {
        // ignore teardown cleanup failures
      }
      await stopMysqlServer(setup);
    }
  });

  it('automatically populates the ID after flush', async () => {
    const entity = new ReproIdentity();
    entity.name = 'Test Identity';

    await setup.session.persist(entity);
    await setup.session.flush();

    console.log('Entity after flush:', entity);

    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });
});
