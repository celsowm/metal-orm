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

  it('returns undefined views when includeViews is false', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: false,
    });

    expect(schema.views).toBeUndefined();
  });

  it('returns undefined views when includeViews is not set', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
    });

    expect(schema.views).toBeUndefined();
  });

  it('introspects view vw_afastamento_pessoa with columns', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
    });

    expect(schema.views).toBeDefined();
    expect(Array.isArray(schema.views)).toBe(true);
    expect(schema.views!.length).toBeGreaterThan(0);

    const view = schema.views!.find((v) => v.name === 'vw_afastamento_pessoa');
    expect(view).toBeDefined();
    expect(view!.name).toBe('vw_afastamento_pessoa');
    expect(view!.schema).toBe('dbo');
    expect(Array.isArray(view!.columns)).toBe(true);
    expect(view!.columns.length).toBeGreaterThan(0);

    // View definition should be present (SQL CREATE VIEW statement)
    expect(view!.definition).toBeDefined();
    expect(typeof view!.definition).toBe('string');
    expect(view!.definition!.toLowerCase()).toContain('create');
    expect(view!.definition!.toLowerCase()).toContain('view');
  });

  it('view columns have required properties with correct types', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
    });

    const view = schema.views!.find((v) => v.name === 'vw_afastamento_pessoa');
    expect(view).toBeDefined();

    for (const col of view!.columns) {
      // name must be a non-empty string
      expect(col.name).toBeDefined();
      expect(typeof col.name).toBe('string');
      expect(col.name.length).toBeGreaterThan(0);

      // type must be a non-empty string
      expect(col.type).toBeDefined();
      expect(typeof col.type).toBe('string');
      expect(col.type.length).toBeGreaterThan(0);

      // notNull must be a boolean
      expect(typeof col.notNull).toBe('boolean');
    }
  });

  it('excludes views via excludeViews option', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
      excludeViews: ['vw_afastamento_pessoa'],
    });

    expect(schema.views).toBeDefined();

    const excluded = schema.views!.find((v) => v.name === 'vw_afastamento_pessoa');
    expect(excluded).toBeUndefined();
  });

  it('excludes multiple views via excludeViews array', async () => {
    const schemaWithViews = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
    });

    // Get first two view names to exclude
    const viewNames = schemaWithViews.views!.slice(0, 2).map((v) => v.name);
    expect(viewNames.length).toBeGreaterThanOrEqual(1);

    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
      excludeViews: viewNames,
    });

    for (const name of viewNames) {
      const excluded = schema.views!.find((v) => v.name === name);
      expect(excluded).toBeUndefined();
    }
  });

  it('tables are still returned when includeViews is true', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
    });

    expect(schema.tables).toBeDefined();
    expect(Array.isArray(schema.tables)).toBe(true);
    expect(schema.tables.length).toBeGreaterThan(0);
  });

  it('view columns do not have table-specific properties', async () => {
    const schema = await introspectSchema(executor, 'mssql', {
      schema: 'dbo',
      includeViews: true,
    });

    const view = schema.views!.find((v) => v.name === 'vw_afastamento_pessoa');
    expect(view).toBeDefined();

    for (const col of view!.columns) {
      // Views should not have autoIncrement, references, default, etc.
      expect(col.autoIncrement).toBeUndefined();
      expect(col.references).toBeUndefined();
    }
  });
}, 60_000);
