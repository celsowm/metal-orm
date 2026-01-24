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
 * Cleans the database by truncating all tables.
 * Much faster than dropping/recreating the database.
 */
export const cleanDatabase = async (): Promise<void> => {
  const setup = getMysqlSetup();

  try {
    // Disable FK checks for faster truncation
    await setup.connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    // Get all tables
    const [tables] = await setup.connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
    );
    
    // Drop all tables (faster than truncate for small tables, and resets auto_increment)
    for (const row of tables as any[]) {
      await setup.connection.query(`DROP TABLE IF EXISTS \`${row.TABLE_NAME || row.table_name}\``);
    }
    
    // Re-enable FK checks
    await setup.connection.query('SET FOREIGN_KEY_CHECKS = 1');
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
