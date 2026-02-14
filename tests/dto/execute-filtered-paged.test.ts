/// <reference types="vitest" />

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import {
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { type OrmSession } from '../../src/orm/orm-session.js';
import { eq } from '../../src/core/ast/expression.js';
import { col, defineTable, insertInto, selectFrom } from '../../src/index.js';
import {
  executeFilteredPaged,
  toPagedResponse
} from '../../src/dto/index.js';
import { closeDb, createSqliteSessionFromDb } from '../e2e/sqlite-helpers.js';

const usersTable = defineTable('dto_users', {
  id: col.primaryKey(col.int()),
  name: col.notNull(col.varchar(100)),
  age: col.int(),
  active: col.boolean()
});

const legacyTable = defineTable('dto_legacy_items', {
  code: col.primaryKey(col.int()),
  label: col.notNull(col.varchar(100))
});

@Entity()
class DtoCustomer {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;
}

describe('executeFilteredPaged', () => {
  let db: sqlite3.Database;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();
    db = new sqlite3.Database(':memory:');
    session = createSqliteSessionFromDb(db);

    const customerTable = getTableDefFromEntity(DtoCustomer)!;

    await executeSchemaSqlFor(
      session.executor,
      new SQLiteSchemaDialect(),
      usersTable,
      legacyTable,
      customerTable
    );

    let compiled = insertInto(usersTable).values([
      { id: 2, name: 'Alice', age: 31, active: true },
      { id: 1, name: 'Alice', age: 22, active: true },
      { id: 3, name: 'Bob', age: 41, active: false },
      { id: 4, name: 'Carol', age: 28, active: true }
    ]).compile(session.dialect);
    await session.executor.executeSql(compiled.sql, compiled.params);

    compiled = insertInto(legacyTable).values([
      { code: 30, label: 'third' },
      { code: 10, label: 'first' },
      { code: 20, label: 'second' }
    ]).compile(session.dialect);
    await session.executor.executeSql(compiled.sql, compiled.params);

    compiled = insertInto(DtoCustomer).values([
      { id: 2, name: 'Zelda' },
      { id: 1, name: 'Alice' }
    ]).compile(session.dialect);
    await session.executor.executeSql(compiled.sql, compiled.params);
  });

  afterAll(async () => {
    await closeDb(db);
  });

  it('applies filters and valid sort', async () => {
    const result = await executeFilteredPaged({
      qb: selectFrom(usersTable).select('id', 'name', 'active'),
      tableOrEntity: usersTable,
      session,
      page: 1,
      pageSize: 10,
      filters: { active: { equals: true } },
      sortBy: 'name',
      sortDirection: 'ASC',
      allowedSortColumns: {
        name: usersTable.columns.name,
        age: usersTable.columns.age
      }
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2, 4]);
    expect(result.totalItems).toBe(3);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('throws when sortBy is not in allowedSortColumns', async () => {
    await expect(
      executeFilteredPaged({
        qb: selectFrom(usersTable).select('id', 'name'),
        tableOrEntity: usersTable,
        session,
        page: 1,
        pageSize: 10,
        sortBy: 'createdAt',
        allowedSortColumns: {
          name: usersTable.columns.name
        }
      })
    ).rejects.toThrow('Invalid sortBy "createdAt"');
  });

  it('uses configured defaultSortBy when sortBy is not provided', async () => {
    const result = await executeFilteredPaged({
      qb: selectFrom(usersTable).select('id', 'name'),
      tableOrEntity: usersTable,
      session,
      page: 1,
      pageSize: 10,
      defaultSortBy: 'name',
      allowedSortColumns: {
        name: usersTable.columns.name
      }
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('falls back to detected primary key when no sort is provided', async () => {
    const result = await executeFilteredPaged({
      qb: selectFrom(legacyTable).select('code', 'label'),
      tableOrEntity: legacyTable,
      session,
      page: 1,
      pageSize: 10
    });

    expect(result.items.map((item) => item.code)).toEqual([10, 20, 30]);
  });

  it('always adds deterministic tie-break by id ASC when available', async () => {
    const result = await executeFilteredPaged({
      qb: selectFrom(usersTable).select('id', 'name'),
      tableOrEntity: usersTable,
      session,
      page: 1,
      pageSize: 10,
      sortBy: 'name',
      sortDirection: 'ASC',
      allowedSortColumns: {
        name: usersTable.columns.name
      }
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2, 3, 4]);
  });

  it('returns shape compatible with toPagedResponse', async () => {
    const manual = await selectFrom(usersTable)
      .select('id', 'name', 'active')
      .where(eq(usersTable.columns.active, true))
      .orderBy(usersTable.columns.name, 'ASC')
      .orderBy(usersTable.columns.id, 'ASC')
      .executePaged(session, { page: 1, pageSize: 10 });

    const expected = toPagedResponse(manual);
    const result = await executeFilteredPaged({
      qb: selectFrom(usersTable).select('id', 'name', 'active'),
      tableOrEntity: usersTable,
      session,
      page: 1,
      pageSize: 10,
      filters: { active: { equals: true } },
      sortBy: 'name',
      sortDirection: 'ASC',
      allowedSortColumns: {
        name: usersTable.columns.name
      }
    });

    expect(result).toEqual(expected);
  });

  it('works with selectFromEntity and entity target', async () => {
    const customerTable = getTableDefFromEntity(DtoCustomer)!;
    const result = await executeFilteredPaged({
      qb: selectFromEntity(DtoCustomer).select('id', 'name'),
      tableOrEntity: DtoCustomer,
      session,
      page: 1,
      pageSize: 10,
      sortBy: 'name',
      allowedSortColumns: {
        name: customerTable.columns.name
      }
    });

    expect(result.items.map((item) => item.id)).toEqual([1, 2]);
  });
});
