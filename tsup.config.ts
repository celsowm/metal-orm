import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'], // single entrypoint to avoid duplicating runtime state
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true
});
