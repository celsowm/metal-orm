import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';
import { esel } from '../../../src/query-builder/select-helpers.js';
import { bootstrapEntities, getTableDefFromEntity, selectFromEntity } from '../../../src/decorators/index.js';
import { applyFilter } from '../../../src/dto/apply-filter.js';
import type { WhereInput } from '../../../src/dto/index.js';
import { executeSchemaSqlFor } from '../../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { closeDb, createSqliteSessionFromDb, runSql } from '../sqlite-helpers.ts';
import { Attorney, CollectionLawsuit } from './entities.ts';

describe('Combined and Complex filtering', () => {
  let db: sqlite3.Database;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    bootstrapEntities();
    const session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(),
      getTableDefFromEntity(Attorney)!, getTableDefFromEntity(CollectionLawsuit)!);

    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [1, 'Dr. Maria Silva', 'maria@adv.br', 'OAB/SP 123456']);
    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [2, 'Dr. João Santos', 'joao@adv.br', 'OAB/RJ 654321']);

    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [1, '2024.001', 'High Priority - Maria', 500000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [2, '2024.002', 'Low Priority - Maria', 10000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [3, '2024.003', 'Pending - Maria', 200000, 'pending', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [4, '2024.004', 'High Priority - João', 500000, 'active', 2]);
  });

  afterEach(async () => { await closeDb(db); });

  it('filters by lawsuit status AND attorney name', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'status')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = {
      status: { equals: 'active' },
      attorney: { some: { name: { contains: 'Maria' } } }
    };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits.every(l => l.status === 'active' && l.attorney?.name?.includes('Maria'))).toBe(true);
  });

  it('filters by amount range AND attorney name', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'amount')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = {
      amount: { gte: 100000, lte: 600000 },
      attorney: { some: { name: { contains: 'Maria' } } }
    };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits[0].caseNumber).toBe('2024.001');
    expect(lawsuits[1].caseNumber).toBe('2024.003');
  });

  it('filters with pagination', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { name: { contains: 'Maria' } } } };
    const filteredQb = applyFilter(qb, CollectionLawsuit, where);
    const result = await filteredQb.executePaged(session, { page: 1, pageSize: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.totalItems).toBe(3);
    expect(result.items.every(l => l.attorney?.name?.includes('Maria'))).toBe(true);
  });

  it('returns empty array for no match', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { name: { contains: 'NonExistent' } } } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(0);
  });
});
