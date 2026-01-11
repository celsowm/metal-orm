import { beforeAll, afterAll, beforeEach } from 'vitest';
import { ensureMysqlSetup, cleanupMysqlSetup, cleanDatabase } from '../mysql-setup.js';

/**
 * Global setup for MySQL E2E tests using singleton pattern.
 * 
 * This setup file:
 * 1. Initializes a single MySQL server instance before all tests (beforeAll)
 * 2. Cleans the database before each test for isolation (beforeEach)
 * 3. Tears down the MySQL server after all tests complete (afterAll)
 * 
 * Benefits:
 * - Massive performance improvement (single server startup vs. per-test startup)
 * - Test isolation maintained through database cleanup
 * - Especially beneficial on Windows where MySQL binary download is required
 */

// Initialize MySQL server once before all tests in this directory
beforeAll(async () => {
    console.log('🚀 Initializing MySQL memory server (singleton)...');
    await ensureMysqlSetup();
    console.log('✅ MySQL memory server ready');
}, 60000); // 60s timeout for first-time MySQL download

// Clean database before each test to ensure isolation
beforeEach(async () => {
    await cleanDatabase();
});

// Cleanup after all tests complete
afterAll(async () => {
    console.log('🧹 Cleaning up MySQL memory server...');
    await cleanupMysqlSetup();
    console.log('✅ MySQL memory server stopped');
});
