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

describe('Filter by Attorney relation', () => {
  let db: sqlite3.Database;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    bootstrapEntities();
    const session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(),
      getTableDefFromEntity(Attorney)!, getTableDefFromEntity(CollectionLawsuit)!);

    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [1, 'Dr. Maria Silva', 'maria@adv.br', 'OAB/SP 123456']);
    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [2, 'Dr. João Santos', 'joao@adv.br', 'OAB/RJ 654321']);
    await runSql(db, 'INSERT INTO attorneys (id, name, email, oabNumber) VALUES (?, ?, ?, ?);', [3, 'Dra. Ana Costa', 'ana@costa.adv.br', 'OAB/MG 789012']);

    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);', [1, '2024.001', 'Case 1', 1000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);', [2, '2024.002', 'Case 2', 2000, 'active', 1]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);', [3, '2024.003', 'Case 3', 3000, 'active', 2]);
    await runSql(db, 'INSERT INTO collection_lawsuits (id, caseNumber, description, amount, status, attorneyId) VALUES (?, ?, ?, ?, ?, ?);', [4, '2024.004', 'Case 4', 4000, 'pending', 3]);
  });

  afterEach(async () => { await closeDb(db); });

  it('filters by attorney name contains', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { name: { contains: 'Maria' } } } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits.every(l => l.attorney?.name?.includes('Maria'))).toBe(true);
  });

  it('filters by attorney id equals', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { id: { equals: 2 } } } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(1);
    expect(lawsuits[0].caseNumber).toBe('2024.003');
  });

  it('filters by attorney email endsWith', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { email: { endsWith: '@costa.adv.br' } } } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(1);
    expect(lawsuits[0].attorney?.email).toBe('ana@costa.adv.br');
  });

  it('filters by attorney id in array', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    const where: WhereInput<typeof CollectionLawsuit> = { attorney: { some: { id: { in: [1, 3] } } } };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    expect(lawsuits).toHaveLength(3);
    expect(lawsuits.map(l => l.caseNumber).sort()).toEqual(['2024.001', '2024.002', '2024.004']);
  });

  it('demonstrates that WITHOUT "some" filter is NOT applied - returns all rows', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    // Without 'some', the filter object is not recognized as a relation filter
    // and no filtering is applied - all 4 lawsuits are returned
    const where = {
      attorney: {
        name: { contains: 'Maria' }
      }
    } as WhereInput<typeof CollectionLawsuit>;
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    // This shows that without 'some', the filter is silently ignored
    expect(lawsuits).toHaveLength(4); // All rows returned, filter not applied!
    console.log('Without "some": filter ignored, all rows returned');
  });

  it('confirms "some" is REQUIRED for BelongsTo relation filtering', async () => {
    const session = createSqliteSessionFromDb(db);
    const qb = selectFromEntity(CollectionLawsuit).select(esel(CollectionLawsuit, 'id', 'caseNumber')).include('attorney');
    // With 'some', the filter works correctly
    const where: WhereInput<typeof CollectionLawsuit> = {
      attorney: { some: { name: { contains: 'Maria' } } }
    };
    const lawsuits = await applyFilter(qb, CollectionLawsuit, where).execute(session);
    // With 'some', only Maria's lawsuits are returned
    expect(lawsuits).toHaveLength(2);
    expect(lawsuits.every(l => l.attorney?.name?.includes('Maria'))).toBe(true);
  });
});
