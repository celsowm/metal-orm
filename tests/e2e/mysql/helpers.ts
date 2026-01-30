import { getSetup as getSetupFromConnection, initFromConfig, cleanDatabase as cleanDb } from './mysql-connection.js';
import { ensureMysqlSetup, getMysqlSetup as getSetupFromModule, cleanDatabase as cleanDbLegacy } from '../mysql-setup.js';
import { type MysqlTestSetup, getTestConfigPath } from '../mysql-helpers.js';
import type mysql from 'mysql2/promise';
import { existsSync } from 'fs';
import { join } from 'path';

const CONFIG_FILE = getTestConfigPath();

/**
 * Helper utilities specific to MySQL E2E tests.
 * Supports both global setup (fast) and legacy singleton pattern.
 */

/**
 * Gets the current MySQL test setup (connection, session, etc.)
 * Uses global setup if available, otherwise falls back to singleton.
 */
export const getSetup = async (): Promise<MysqlTestSetup> => {
    // Prefer global setup (config file exists)
    if (existsSync(CONFIG_FILE)) {
        await initFromConfig();
        return getSetupFromConnection();
    }

    // Fallback to legacy singleton
    await ensureMysqlSetup();
    return getSetupFromModule();
};

/**
 * Cleans the database to ensure test isolation.
 */
export const cleanDatabase = async (): Promise<void> => {
    if (existsSync(CONFIG_FILE)) {
        await initFromConfig();
        await cleanDb();
    } else {
        await ensureMysqlSetup();
        await cleanDbLegacy();
    }
};

/**
 * Creates a table with a simple schema for testing.
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
 * Seeds the users table with test data using batch insert.
 */
export const seedUsers = async (
    connection: mysql.Connection,
    users: Array<{ name: string; email?: string }>
): Promise<void> => {
    if (users.length === 0) return;

    const placeholders = users.map(() => '(?, ?)').join(', ');
    const values = users.flatMap(u => [u.name, u.email || null]);

    await connection.execute(
        `INSERT INTO users (name, email) VALUES ${placeholders}`,
        values
    );
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
