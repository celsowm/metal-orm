import 'tsconfig-paths/register';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { playgroundApiPlugin } from './playground/api/playground-api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [
        react(),
        playgroundApiPlugin(),
    ],
    resolve: {
        alias: {
            '@orm': path.resolve(__dirname, './src'),
            'playground': path.resolve(__dirname, './playground'),
        },
    },
    root: './playground',
});
