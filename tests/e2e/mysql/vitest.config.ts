import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest configuration for MySQL E2E tests.
 * 
 * Key settings:
 * - setupFiles: Runs setup.ts before tests (initializes singleton MySQL server)
 * - maxWorkers: 1 - Runs tests sequentially to avoid database conflicts
 * - Higher timeouts to account for MySQL server initialization
 */
export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [path.resolve(__dirname, './setup.ts')],
        testTimeout: 30000,
        hookTimeout: 60000,
        // Run tests sequentially to avoid database conflicts
        // The singleton pattern shares one MySQL server and database
        maxWorkers: 1,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../../../src'),
        },
    },
});
