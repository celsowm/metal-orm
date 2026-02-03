import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';
import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import { introspectSchema } from '../../../src/core/ddl/schema-introspect.js';
import type { DbExecutor } from '../../../src/core/execution/db-executor.js';

const hasEnv =
  !!process.env.PGE_DIGITAL_HOST &&
  !!process.env.PGE_DIGITAL_USER &&
  !!process.env.PGE_DIGITAL_PASSWORD;

const maybe = hasEnv ? describe : describe.skip;

maybe('MSSQL view introspection (e2e)', () => {
  let connection: Connection;
  let executor: DbExecutor;

  beforeAll(async () => {
    const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;

    connection = await new Promise<Connection>((resolve, reject) => {
      const conn = new Connection({
        server: PGE_DIGITAL_HOST!,
        authentication: {
          type: 'default',
          options: {
            userName: PGE_DIGITAL_USER!,
            password: PGE_DIGITAL_PASSWORD!,
          },
        },
        options: {
          database: 'PGE_DIGITAL',
          encrypt: true,
          trustServerCertificate: true,
        },
      });

      conn.on('connect', (err) => {
        if (err) reject(err);
        else resolve(conn);
      });

      conn.connect();
    });

    executor = createTediousExecutor(connection, { Request, TYPES });
  });

  afterAll(() => {
    connection?.close();
  });

  const introspect = (options: Parameters<typeof introspectSchema>[2]) =>
    introspectSchema(executor, 'mssql', { schema: 'dbo', ...options });

  it('skips views when includeViews is false', async () => {
    const schema = await introspect({ includeViews: false });
    expect(schema.views).toBeUndefined();
  });

  it('returns view metadata when includeViews is true', async () => {
    const schema = await introspect({ includeViews: true });
    const view = schema.views?.find((v) => v.name === 'vw_afastamento_pessoa');
    expect(view).toBeDefined();
    expect(view?.definition).toBeDefined();
    expect(view?.definition!.toLowerCase()).toContain('create view');
    expect(view?.columns.length).toBeGreaterThan(0);
  });
}, 60_000);
