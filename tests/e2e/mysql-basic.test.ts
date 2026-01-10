import { beforeAll, describe, expect, it } from 'vitest';

import { getMysqlSetup } from './mysql-setup.js';

describe('MySQL memory server basic test', () => {
  let setup: ReturnType<typeof getMysqlSetup>;

  beforeAll(() => {
    setup = getMysqlSetup();
  });

  it('can start and stop mysql memory server', async () => {
    expect(setup.db.port).toBeDefined();
    expect(setup.db.dbName).toBeDefined();
  });
});
