import { beforeAll, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { between, notBetween, or, isNotNull } from '../../../src/core/ast/expression.js';

const VwAfastamentoPessoa = defineTable('vw_afastamento_pessoa', {
  id: col.int(),
  pessoa_id: col.int(),
  data_inicio: col.date(),
  data_fim: col.date(),
  tipo_afastamento: col.varchar(255),
  descricao: col.varchar(500)
});

describeMssql('BETWEEN E2E with SQL Server (vw_afastamento_pessoa)', () => {
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  beforeAll(async () => {
    ({ session } = await getSetup());
  });

  it('should query with BETWEEN on data_inicio date column', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio', 'data_fim')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
      .limit(10);

    const compiled = query.compile(new SqlServerDialect());
    expect(compiled.sql).toContain('BETWEEN');
    expect(compiled.sql).toContain('[vw_afastamento_pessoa]');

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with BETWEEN on data_fim date column', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio', 'data_fim')
      .where(between(VwAfastamentoPessoa.columns.data_fim, '2020-01-01', '2025-12-31'))
      .limit(10);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with NOT BETWEEN on date columns', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio')
      .where(notBetween(VwAfastamentoPessoa.columns.data_inicio, '2000-01-01', '2010-12-31'))
      .limit(10);

    const compiled = query.compile(new SqlServerDialect());
    expect(compiled.sql).toContain('NOT BETWEEN');

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with BETWEEN on both data_inicio and data_fim', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio', 'data_fim')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2022-01-01', '2024-12-31'))
      .where(between(VwAfastamentoPessoa.columns.data_fim, '2022-01-01', '2025-12-31'))
      .limit(10);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with BETWEEN combined with eq condition', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
      .where(isNotNull(VwAfastamentoPessoa.columns.data_fim))
      .limit(10);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with OR between two date ranges', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio')
      .where(or(
        between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2020-12-31'),
        between(VwAfastamentoPessoa.columns.data_inicio, '2023-01-01', '2023-12-31')
      ))
      .limit(10);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should query with BETWEEN and ORDER BY', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'))
      .orderBy(VwAfastamentoPessoa.columns.data_inicio, 'DESC')
      .limit(5);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should return correct row count with BETWEEN filter', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2023-01-01', '2023-12-31'))
      .limit(100);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('id');
    }
  });

  it('should handle current year date range', async () => {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear}-01-01`;
    const endDate = `${currentYear}-12-31`;

    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, startDate, endDate))
      .limit(10);

    const results = await query.execute(session);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle paged query with BETWEEN', async () => {
    const query = new SelectQueryBuilder(VwAfastamentoPessoa)
      .select('id', 'data_inicio', 'data_fim')
      .where(between(VwAfastamentoPessoa.columns.data_inicio, '2020-01-01', '2024-12-31'));

    const pagedResult = await query.executePaged(session, { page: 1, pageSize: 5 });
    expect(pagedResult).toHaveProperty('items');
    expect(pagedResult).toHaveProperty('totalItems');
    expect(pagedResult).toHaveProperty('page');
    expect(pagedResult).toHaveProperty('pageSize');
    expect(Array.isArray(pagedResult.items)).toBe(true);
    expect(pagedResult.items.length).toBeLessThanOrEqual(5);
  });
});
