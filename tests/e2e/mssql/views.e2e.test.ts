import { beforeAll, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { introspectSchema } from '../../../src/core/ddl/schema-introspect.js';

describeMssql('MSSQL view introspection (e2e)', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];

  beforeAll(async () => {
    ({ executor } = await getSetup());
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
});
