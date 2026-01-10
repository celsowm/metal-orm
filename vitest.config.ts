import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        watch: false,
        testTimeout: 60000,
        hookTimeout: 60000,
        setupFiles: ['./tests/setup-mysql.ts'],
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
