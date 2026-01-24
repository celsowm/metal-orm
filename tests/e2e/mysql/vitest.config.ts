import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    test: {
        include: ['**/*.test.ts'],
        exclude: ['node_modules'],
        environment: 'node',
        globals: true,
        globalSetup: './global-setup.ts',
        setupFiles: ['./test-setup.ts'],
        testTimeout: 30000,
        hookTimeout: 30000,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('../../../src', import.meta.url)),
        },
    },
});
