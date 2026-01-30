import { createDB } from 'mysql-memory-server';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { cleanupStaleLocks, getTestConfigPath } from '../mysql-helpers.js';

const CONFIG_FILE = getTestConfigPath();

let db: any = null;

export interface MysqlConfig {
    port: number;
    username: string;
    dbName: string;
}

export async function setup() {
    console.log('🚀 Starting MySQL memory server (global setup)...');
    cleanupStaleLocks();

    db = await createDB({
        logLevel: 'ERROR',
        version: '9.5.0',
    });

    const config: MysqlConfig = {
        port: db.port,
        username: db.username,
        dbName: db.dbName,
    };

    // Write config to file for tests to read
    writeFileSync(CONFIG_FILE, JSON.stringify(config));

    console.log(`✅ MySQL ready on port ${db.port}`);
}

export async function teardown() {
    console.log('🧹 Stopping MySQL memory server...');

    if (db) {
        await db.stop();
    }

    // Clean up config file
    if (existsSync(CONFIG_FILE)) {
        unlinkSync(CONFIG_FILE);
    }

    console.log('✅ MySQL stopped');
}
