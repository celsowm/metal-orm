import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    test: {
        root: fileURLToPath(new URL('.', import.meta.url)),
        include: ['**/*.test.ts'],
        exclude: ['node_modules'],
        environment: 'node',
        globals: true,
        globalSetup: './global-setup.ts',
        setupFiles: ['./test-setup.ts'],
        testTimeout: 60000,
        hookTimeout: 60000,
        isolate: true,
        fileParallelism: false,
        maxWorkers: 1,
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('../../../src', import.meta.url)),
        },
    },
});
