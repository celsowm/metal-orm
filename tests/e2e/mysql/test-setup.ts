import { beforeEach } from 'vitest';
import { cleanDatabase, initFromConfig } from './mysql-connection.js';

// Initialize connection from config file written by global-setup
beforeEach(async () => {
    await initFromConfig();
    await cleanDatabase();
});
