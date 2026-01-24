import { beforeAll, afterAll, beforeEach } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { ensureMysqlSetup, cleanupMysqlSetup, cleanDatabase as cleanDbLegacy } from '../mysql-setup.js';
import { initFromConfig, cleanDatabase as cleanDbFromConfig, closeConnection } from './mysql-connection.js';

/**
 * Global setup for MySQL E2E tests.
 *
 * - Uses the shared config file when running with the optimized vitest config.
 * - Falls back to the singleton mysql-memory-server when running standalone.
 */
const CONFIG_FILE = join(__dirname, '.mysql-config.json');

const hasConfig = (): boolean => existsSync(CONFIG_FILE);

// Initialize MySQL server once before all tests in this directory.
beforeAll(async () => {
    if (hasConfig()) {
        await initFromConfig();
        return;
    }

    console.log('🚀 Initializing MySQL memory server (singleton)...');
    await ensureMysqlSetup();
    console.log('✅ MySQL memory server ready');
}, 180000); // 3 minutes timeout for first-time MySQL download

// Clean database before each test to ensure isolation.
beforeEach(async () => {
    if (hasConfig()) {
        await initFromConfig();
        await cleanDbFromConfig();
        return;
    }

    await cleanDbLegacy();
});

// Cleanup after all tests complete.
afterAll(async () => {
    if (hasConfig()) {
        await closeConnection();
        return;
    }

    console.log('🧹 Cleaning up MySQL memory server...');
    await cleanupMysqlSetup();
    console.log('✅ MySQL memory server stopped');
});
