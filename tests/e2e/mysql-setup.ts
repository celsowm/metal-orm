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

/**
 * Cleans the database by dropping and recreating it.
 * This provides test isolation without the overhead of restarting the MySQL server.
 * Much faster than stopMysqlServer() + createMysqlServer().
 */
export const cleanDatabase = async (): Promise<void> => {
  const setup = getMysqlSetup();

  // Get the database name from the setup
  const dbName = setup.db?.dbName || 'test';

  try {
    // Drop and recreate the database for a clean slate
    await setup.connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await setup.connection.query(`CREATE DATABASE \`${dbName}\``);
    await setup.connection.query(`USE \`${dbName}\``);
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
};

export const cleanupMysqlSetup = async (): Promise<void> => {
  if (mysqlSetup) {
    await stopMysqlServer(mysqlSetup);
    mysqlSetup = null;
    initPromise = null;
  }
};
