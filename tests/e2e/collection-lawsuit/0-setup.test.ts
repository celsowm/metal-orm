import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { bootstrapEntities, getTableDefFromEntity, selectFromEntity, entityRef } from '../../../src/decorators/index.js';
import { executeSchemaSqlFor } from '../../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { insertInto } from '../../../src/query/index.js';
import { closeDb, createSqliteSessionFromDb } from '../sqlite-helpers.ts';
import { Attorney, CollectionLawsuit } from './entities.ts';

describe('CollectionLawsuit + Attorney Setup', () => {
  let db: sqlite3.Database;

  beforeEach(() => { db = new sqlite3.Database(':memory:'); });
  afterEach(async () => { await closeDb(db); });

  it('should create entities and insert test data', async () => {
    bootstrapEntities();
    const session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), 
      getTableDefFromEntity(Attorney)!, getTableDefFromEntity(CollectionLawsuit)!);

    const attorneyCompiled = insertInto(Attorney).values([
      { id: 1, name: 'Dr. Maria Silva', email: 'maria@adv.br', oabNumber: 'OAB/SP 123456', phone: '(11) 98765-4321' },
      { id: 2, name: 'Dr. João Santos', email: 'joao@adv.br', oabNumber: 'OAB/RJ 654321', phone: '(21) 91234-5678' },
      { id: 3, name: 'Dra. Ana Costa', email: 'ana@adv.br', oabNumber: 'OAB/MG 789012', phone: '(31) 99876-5432' }
    ]).compile(session.dialect);
    await session.executor.executeSql(attorneyCompiled.sql, attorneyCompiled.params);

    const lawsuitCompiled = insertInto(CollectionLawsuit).values([
      { id: 1, caseNumber: '2024.001', description: 'Cobrança Empresa A', amount: 150000, status: 'active', attorneyId: 1 },
      { id: 2, caseNumber: '2024.002', description: 'Cobrança Empresa B', amount: 75000, status: 'pending', attorneyId: 1 },
      { id: 3, caseNumber: '2024.003', description: 'Cobrança Empresa C', amount: 250000, status: 'active', attorneyId: 2 },
      { id: 4, caseNumber: '2024.004', description: 'Cobrança Empresa D', amount: 50000, status: 'closed', attorneyId: 2 },
      { id: 5, caseNumber: '2024.005', description: 'Acordo Empresa E', amount: 300000, status: 'active', attorneyId: 3 },
      { id: 6, caseNumber: '2024.006', description: 'Acordo Empresa F', amount: 125000, status: 'suspended', attorneyId: 3 }
    ]).compile(session.dialect);
    await session.executor.executeSql(lawsuitCompiled.sql, lawsuitCompiled.params);

    const c = entityRef(CollectionLawsuit);
    const result = await selectFromEntity(CollectionLawsuit)
      .select({ id: c.$.id, caseNumber: c.$.caseNumber })
      .include('attorney')
      .orderBy(c.$.id)
      .execute(session);

    expect(result).toHaveLength(6);
    expect(result[0].attorney?.name).toBe('Dr. Maria Silva');
  });
});
