import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { col, defineTable } from '../../src/index.js';
import { generateCreateTableSql } from '../../src/core/ddl/schema-generator.js';
import { diffSchema } from '../../src/core/ddl/schema-diff.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { sqliteIntrospector } from '../../src/core/ddl/introspect/sqlite.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { createBetterSqlite3Executor } from '../../src/core/execution/executors/better-sqlite3-executor.js';

const parents = defineTable('fk_parents', {
  id: col.primaryKey(col.int())
});

const children = defineTable('fk_children', {
  id: col.primaryKey(col.int()),
  parent_id: col.references(col.int(), {
    table: 'fk_parents',
    column: 'id',
    name: 'fk_children_parent',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
    deferrable: true
  })
});

describe('SQLite named deferred foreign keys', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    const dialect = new SQLiteSchemaDialect();
    db.exec(generateCreateTableSql(parents, dialect).tableSql);
    db.exec(generateCreateTableSql(children, dialect).tableSql);
  });

  afterAll(() => {
    db.close();
  });

  it('renders, introspects and diffs the full foreign-key contract', async () => {
    const dialect = new SQLiteSchemaDialect();
    const childSql = generateCreateTableSql(children, dialect).tableSql;

    expect(childSql).toContain('CONSTRAINT "fk_children_parent" REFERENCES "fk_parents" ("id")');
    expect(childSql).toContain('ON DELETE CASCADE');
    expect(childSql).toContain('ON UPDATE RESTRICT');
    expect(childSql).toContain('DEFERRABLE INITIALLY DEFERRED');

    const executor = createBetterSqlite3Executor(db);
    const actual = await sqliteIntrospector.introspect(
      {
        executor,
        dialect: new SqliteDialect()
      },
      {}
    );

    const child = actual.tables.find(table => table.name === 'fk_children');
    const parentId = child?.columns.find(column => column.name === 'parent_id');

    expect(parentId?.references).toEqual({
      table: 'fk_parents',
      column: 'id',
      name: 'fk_children_parent',
      onDelete: 'CASCADE',
      onUpdate: 'RESTRICT',
      deferrable: true
    });

    const plan = diffSchema([parents, children], actual, dialect);
    expect(plan.changes).toEqual([]);
    expect(plan.warnings).toEqual([]);
  });

  it('actually defers enforcement until commit', () => {
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO fk_children(id, parent_id) VALUES (?, ?)').run(7, 99);
      db.prepare('INSERT INTO fk_parents(id) VALUES (?)').run(99);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const row = db.prepare(
      'SELECT COUNT(*) AS count FROM fk_children WHERE id = 7 AND parent_id = 99'
    ).get() as { count: number };
    expect(row.count).toBe(1);
  });

  it('detects deferrability drift instead of silently accepting it', async () => {
    const executor = createBetterSqlite3Executor(db);
    const actual = await sqliteIntrospector.introspect(
      {
        executor,
        dialect: new SqliteDialect()
      },
      {}
    );
    const child = actual.tables.find(table => table.name === 'fk_children')!;
    const parentId = child.columns.find(column => column.name === 'parent_id')!;
    parentId.references = { ...parentId.references!, deferrable: false };

    const plan = diffSchema([parents, children], actual, new SQLiteSchemaDialect());
    expect(plan.warnings.some(warning => /Foreign key definition on fk_children\.parent_id differs/.test(warning)))
      .toBe(true);
  });
});
