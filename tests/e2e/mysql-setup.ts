import { createMysqlServer, stopMysqlServer, type MysqlTestSetup } from './mysql-helpers.js';

let mysqlSetup: MysqlTestSetup | null = null;

let initPromise: Promise<MysqlTestSetup> | null = null;

export const ensureMysqlSetup = async (): Promise<void> => {
  if (!mysqlSetup) {
    if (!initPromise) {
      initPromise = createMysqlServer().then(setup => {
        mysqlSetup = setup;
        return setup;
      });
    }
    await initPromise;
  }
};

export const getMysqlSetup = (): MysqlTestSetup => {
  if (!mysqlSetup) {
    throw new Error('MySQL server not initialized. Call ensureMysqlSetup() first.');
  }
  return mysqlSetup;
};

export const cleanupMysqlSetup = async (): Promise<void> => {
  if (mysqlSetup) {
    await stopMysqlServer(mysqlSetup);
    mysqlSetup = null;
    initPromise = null;
  }
};
