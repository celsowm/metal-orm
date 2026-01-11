import { getMysqlSetup } from '../mysql-setup.js';
import type { MysqlTestSetup } from '../mysql-helpers.js';
import type mysql from 'mysql2/promise';

/**
 * Helper utilities specific to MySQL E2E tests.
 * These functions automatically initialize MySQL singleton if not already available.
 */

/**
 * Gets the current MySQL test setup (connection, session, etc.)
 * Automatically initializes MySQL server if not already running.
 * This allows tests to work with or without setup.ts.
 */
export const getSetup = async (): Promise<MysqlTestSetup> => {
    const { ensureMysqlSetup, getMysqlSetup } = await import('../mysql-setup.js');
    await ensureMysqlSetup();
    return getMysqlSetup();
};

/**
 * Cleans the database to ensure test isolation.
 * Call this in beforeEach hooks when not using setup.ts.
 */
export const cleanDatabase = async (): Promise<void> => {
    const { ensureMysqlSetup, cleanDatabase: cleanDb } = await import('../mysql-setup.js');
    await ensureMysqlSetup();
    await cleanDb();
};

/**
 * Creates a table with a simple schema for testing.
 * Useful for quickly setting up test data.
 */
export const createUsersTable = async (connection: mysql.Connection): Promise<void> => {
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

/**
 * Creates a posts table with foreign key to users.
 */
export const createPostsTable = async (connection: mysql.Connection): Promise<void> => {
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
};

/**
 * Seeds the users table with test data.
 */
export const seedUsers = async (
    connection: mysql.Connection,
    users: Array<{ name: string; email?: string }>
): Promise<void> => {
    for (const user of users) {
        await connection.execute(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            [user.name, user.email || null]
        );
    }
};

/**
 * Gets all rows from a table as typed objects.
 */
export const getAllRows = async <T extends Record<string, unknown>>(
    connection: mysql.Connection,
    tableName: string
): Promise<T[]> => {
    const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
    return rows as T[];
};

/**
 * Counts rows in a table.
 */
export const countRows = async (
    connection: mysql.Connection,
    tableName: string
): Promise<number> => {
    const [rows] = await connection.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    return (rows as any)[0].count;
};
