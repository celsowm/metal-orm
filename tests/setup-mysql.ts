import { beforeAll, afterAll } from 'vitest';
import { ensureMysqlSetup, cleanupMysqlSetup } from './e2e/mysql-setup.js';

beforeAll(async () => {
  await ensureMysqlSetup();
});

afterAll(async () => {
  await cleanupMysqlSetup();
});
