
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node', // Use node environment
    globals: true, // Enable globals like describe, it, expect
    coverage: {
      reporter: ['text', 'json', 'html'], // Coverage report formats
    },
    isolate: true, // Run tests in separate worker processes
    projects: [
      {
        extends: true,
        test: {
          include: ['**/*.test.ts', '**/*.spec.ts'],
          exclude: ['node_modules', 'dist', 'playground', 'tests/e2e/mysql/**'],
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        extends: true,
        test: {
          include: ['tests/e2e/mysql/**/*.test.ts'],
          exclude: ['node_modules', 'dist', 'playground'],
          isolate: false,
          fileParallelism: false,
          maxWorkers: 1,
          globalSetup: './tests/e2e/mysql/global-setup.ts',
          setupFiles: ['./tests/e2e/mysql/test-setup.ts'],
          testTimeout: 30000,
          hookTimeout: 30000,
          sequence: {
            groupOrder: 1,
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [],
});
