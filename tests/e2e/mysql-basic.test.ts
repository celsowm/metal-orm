import { describe, expect, it } from 'vitest';

import { createDB } from 'mysql-memory-server';

describe('MySQL memory server basic test', () => {
  it('can start and stop mysql memory server', async () => {
    const db = await createDB();
    expect(db.port).toBeDefined();
    expect(db.dbName).toBeDefined();
    await db.stop();
  }, 120000);
});
