import { beforeEach } from 'vitest';
import { cleanDatabase, initFromConfig } from './mssql-connection.js';
import { isMssqlAvailable } from '../mssql-helpers.js';

beforeEach(async () => {
  if (!isMssqlAvailable()) return;
  await initFromConfig();
  await cleanDatabase();
});
