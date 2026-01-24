import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createMysqlSessionFromConnection, type MysqlTestSetup } from '../mysql-helpers.js';
import type { MysqlConfig } from './global-setup.js';

const CONFIG_FILE = join(__dirname, '.mysql-config.json');

let connection: mysql.Connection | null = null;
let setup: MysqlTestSetup | null = null;
let config: MysqlConfig | null = null;

export async function initFromConfig(): Promise<void> {
    if (connection) return;
    
    if (!existsSync(CONFIG_FILE)) {
        throw new Error('MySQL config file not found. Run tests with: vitest --config tests/e2e/mysql/vitest.config.ts');
    }
    
    config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    
    connection = await mysql.createConnection({
        host: '127.0.0.1',
        user: config!.username,
        port: config!.port,
        database: config!.dbName,
        password: ''
    });
    
    const session = createMysqlSessionFromConnection(connection);
    setup = { db: null, connection, session };
}

export function getSetup(): MysqlTestSetup {
    if (!setup) {
        throw new Error('MySQL not initialized. Call initFromConfig() first.');
    }
    return setup;
}

export async function cleanDatabase(): Promise<void> {
    if (!connection) return;
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const [tables] = await connection.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`
    );
    
    for (const row of tables as any[]) {
        await connection.query(`DROP TABLE IF EXISTS \`${row.TABLE_NAME || row.table_name}\``);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
}

export async function closeConnection(): Promise<void> {
    if (connection) {
        await connection.end();
        connection = null;
        setup = null;
    }
}
