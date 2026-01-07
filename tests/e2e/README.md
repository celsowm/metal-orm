# MySQL E2E Tests

This directory contains end-to-end tests for MySQL using `mysql-memory-server`.

## Setup

MySQL e2e tests use `mysql-memory-server` to create ephemeral MySQL instances. This is great for CI and local development without requiring an external MySQL server.

### First Run

On first run, `mysql-memory-server` will download MySQL binaries if they're not already installed on your system. This can take a significant amount of time:
- **Windows**: No MySQL binary support, MySQL will be downloaded (can take several minutes)
- **macOS/Linux**: May use system MySQL if available, otherwise downloads

The downloaded binaries are cached, so subsequent runs will be much faster.

### Environment Variables

You can configure behavior via environment variables:

```bash
# Use external MySQL instance instead of mysql-memory-server (faster)
# Set this to your MySQL connection URL
export MYSQL_TEST_URL="mysql://root:password@localhost:3306/test_db"

# Use system MySQL instead of downloading (Linux/macOS only)
# This is automatically tried first before downloading
export MYSQL_MEMORY_SERVER_VERSION="8.4.x"

# Enable debug logging to see download progress
export MYSQL_MEMORY_SERVER_LOG_LEVEL="LOG"
```

### Using External MySQL

For faster test runs, you can use an external MySQL instance instead of mysql-memory-server:

```bash
# Start MySQL (Docker example)
docker run --name mysql-test -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=test_db -p 3306:3306 -d mysql:8.4

# Set environment variable
export MYSQL_TEST_URL="mysql://root:password@localhost:3306/test_db"

# Run tests
npm run test:mysql
```

## Running Tests

```bash
# Run all MySQL e2e tests
npm run test:mysql

# Run specific test file
npx vitest tests/e2e/mysql-memory.test.ts

# Run with debug logging
MYSQL_MEMORY_SERVER_LOG_LEVEL="LOG" npm run test:mysql
```

## Helper Functions

See `tests/e2e/mysql-helpers.ts` for helper functions:

- `createMysqlServer()` - Creates a MySQL memory server instance
- `createMysqlServerFromEnv()` - Uses external MySQL from `MYSQL_TEST_URL` env var
- `stopMysqlServer()` - Stops MySQL instance
- `runSql()` - Executes SQL queries
- `queryAll()` - Queries and returns results

## Test Pattern

```typescript
import { createMysqlServer, stopMysqlServer } from './mysql-helpers';

describe('MySQL e2e test', () => {
  it('test something', async () => {
    const setup = await createMysqlServer();
    try {
      // Use setup.session and setup.connection
    } finally {
      await stopMysqlServer(setup);
    }
  });
});
```

## Troubleshooting

### Timeout Issues

If tests timeout, the timeout in `vitest.config.ts` is set to 60 seconds. If MySQL downloads are taking longer, you can increase it:

```typescript
export default defineConfig({
  test: {
    testTimeout: 120000, // 2 minutes
  }
});
```

### Port Conflicts

`mysql-memory-server` automatically selects available ports, so conflicts shouldn't occur.

### Cleanup

Downloaded MySQL binaries are stored in your system's temp directory. To reclaim disk space, you can:
1. Set `downloadBinaryOnce: false` in `createMysqlServer()` options (binaries are deleted after each test)
2. Manually clean up temp directories

### Windows Limitations

MySQL memory server has limited support on Windows. If you encounter issues:
- Consider using WSL (Windows Subsystem for Linux)
- Use external MySQL instance with connection string instead
- Stick to SQLite memory tests for faster local development
