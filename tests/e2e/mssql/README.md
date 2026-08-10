# SQL Server E2E Tests

End-to-end tests for SQL Server. These run against a real SQL Server instance
(Azure SQL Edge / SQL Server container) using the `tedious` driver.

## Setup

The tests connect to an external SQL Server through environment variables
(defaults target a local podman container on port `11433`). There is **no**
ephemeral in-memory SQL Server (unlike MySQL's `mysql-memory-server`); a real
instance is required for these tests to run.

### Starting the container (podman)

```bash
podman machine start
podman start iridium_test_sqlserver
```

Container details (reused from the `iridium-sql` project):

- Image: `mcr.microsoft.com/azure-sql-edge:latest`
- Container name: `iridium_test_sqlserver`
- Host port `11433` -> container port `1433`
- SA password default: `Iridium12345!`

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MSSQL_HOST` | `localhost` | SQL Server host |
| `MSSQL_PORT` | `11433` | SQL Server port |
| `MSSQL_USER` | `sa` | Login user |
| `MSSQL_PASSWORD` | `Iridium12345!` | Login password |
| `MSSQL_DATABASE` | `metal_orm_test` | Test database (created automatically) |
| `MSSQL_ENCRYPT` | `false` | Enable encryption |
| `MSSQL_TRUST_CERT` | `true` | Trust server certificate |

If no SQL Server is reachable the tests **skip automatically** (via
`describe.skip`), so `npm test` stays green without a database.

### Automatic container shutdown

The `global-setup` teardown stops the local SQL Server test containers
(`iridium_test_sqlserver` and `tsql_test_sqlserver`) with `podman stop` when the
test run finishes, so the containers do not stay running after the tests. This
is skipped in CI (where the workflow service container is managed by GitHub
Actions).

## Running Tests

```bash
# Dedicated suite (uses tests/e2e/mssql/vitest.config.ts)
npm run test:mssql

# Run a single file
npx vitest --run --config tests/e2e/mssql/vitest.config.ts views.e2e.test.ts

# Via the root vitest config (skips if DB unavailable)
npm test
```

## Test Pattern

Each test file connects via the shared helper and seeds its own tables inside a
`beforeEach` (the global `test-setup` cleans the test database before each test).

```typescript
import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';

describeMssql('My sqlserver suite', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  beforeEach(async () => {
    ({ executor, session } = await getSetup());
    // create/seed your own tables here
  });

  it('does something', async () => {
    // use executor / session
  });
});
```

## CI

The `release-metal-orm.yml` workflow starts an `mcr.microsoft.com/mssql/server:2022-latest`
service container on port `11433` and sets `MSSQL_*` env vars so `npm test`
runs the SQL Server tests against it.
