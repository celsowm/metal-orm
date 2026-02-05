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

describe('Filter by CollectionLawsuit fields', () => {
  let db: sqlite3.Database;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    bootstrapEntities();
    const session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(),
      getTableDefFromEntity(Attorney)!, getTableDefFromEntity(CollectionLawsuit)!);
    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [1, 'Dr. Test', 'test@adv.br', 'OAB/SP 111111']);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [1, '2024.001', 'Cobrança Empresa Alpha', 150000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [2, '2024.002', 'Cobrança Empresa Beta', 75000, 'pending', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [3, '2024.003', 'Acordo Empresa Gamma', 250000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);',
      [4, '2024.004', 'Cobrança Empresa Delta', 50000, 'closed', 1]);
  });

  afterEach(async () => { await closeDb(db); });

  it('filters by caseNumber equals', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber'));
    const where: WhereInput<typeof CollectionLawsuit> = { caseNumber: { equals: '2024.001' } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(1);
    expect(lawsuits[0].caseNumber).toBe('2024.001');
  });

  it('filters by status equals', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'status'));
    const where: WhereInput<typeof CollectionLawsuit> = { status: { equals: 'active' } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits.every(l => l.status === 'active')).toBe(true);
  });

  it('filters by description contains', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'description'));
    const where: WhereInput<typeof CollectionLawsuit> = { description: { contains: 'Cobrança' } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(3);
    expect(lawsuits.every(l => l.description.includes('Cobrança'))).toBe(true);
  });

  it('filters by amount gte', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'amount'));
    const where: WhereInput<typeof CollectionLawsuit> = { amount: { gte: 100000 } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits.every(l => l.amount >= 100000)).toBe(true);
  });

  it('filters by combined fields', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber', 'status', 'amount'));
    const where: WhereInput<typeof CollectionLawsuit> = { status: { equals: 'active' }, amount: { gte: 200000 } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(1);
    expect(lawsuits[0].caseNumber).toBe('2024.003');
  });
});
