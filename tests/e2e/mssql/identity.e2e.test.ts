import { beforeEach, beforeAll, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
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

describeMssql('MSSQL Identity Retrieval Repro', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  beforeAll(async () => {
    bootstrapEntities();
    ({ executor, session } = await getSetup());
  });

  beforeEach(async () => {
    await executor.executeSql(`
      IF OBJECT_ID('repro_identity_test', 'U') IS NOT NULL
        DROP TABLE repro_identity_test;
      CREATE TABLE repro_identity_test (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name VARCHAR(255)
      );
    `, []);
  });

  it('should automatically populate the ID after flush', async () => {
    const entity = new ReproIdentity();
    entity.name = 'Test Identity';

    await session.persist(entity);
    await session.flush();

    expect(entity.id).toBeDefined();
    expect(typeof entity.id).toBe('number');
  });
});
