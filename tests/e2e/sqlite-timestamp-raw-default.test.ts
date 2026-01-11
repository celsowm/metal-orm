import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { executeSchemaSqlFor, generateCreateTableSql } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

const Events = defineTable('events', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  name: col.notNull(col.varchar(255)),
  createdAt: col.defaultRaw(col.timestamp(), 'NOW'),
});

describe('SQLite timestamp with raw NOW() default', () => {
  it('creates table with raw NOW default timestamp', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['test-event']);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test-event');
      expect(rows[0].createdAt).toBeDefined();
      expect(typeof rows[0].createdAt).toBe('string');
      expect((rows[0].createdAt as string).length).toBeGreaterThan(0);
    } finally {
      await closeDb(db);
    }
  });

  it('handles multiple inserts with consistent NOW() behavior', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-1']);
      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-2']);
      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-3']);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name} ORDER BY id`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('event-1');
      expect(rows[1].name).toBe('event-2');
      expect(rows[2].name).toBe('event-3');

      for (const row of rows) {
        expect(row.createdAt).toBeDefined();
        expect(typeof row.createdAt).toBe('string');
      }
    } finally {
      await closeDb(db);
    }
  });

  it('allows explicit override of createdAt', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      const customDate = '2020-01-01 00:00:00';
      await runSql(db, `INSERT INTO ${Events.name} (name, createdAt) VALUES (?, ?);`, ['custom-event', customDate]);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('custom-event');
      expect(rows[0].createdAt).toBe(customDate);
    } finally {
      await closeDb(db);
    }
  });

  it('correctly generates schema with raw NOW default', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      const tableInfo = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`PRAGMA table_info(${Events.name})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      const createdAtColumn = tableInfo.find((col: Record<string, unknown>) => col.name === 'createdAt');
      expect(createdAtColumn).toBeDefined();
      expect(createdAtColumn.type).toBe('TEXT');
      expect(createdAtColumn.notnull).toBe(0);
    } finally {
      await closeDb(db);
    }
  });
});

describe('SQLite timestamp with raw NOW() default', () => {
  it('debug: shows generated SQL', () => {
    const dialect = new SQLiteSchemaDialect();
    const result = generateCreateTableSql(Events, dialect);
    console.log('Generated SQL:', result.tableSql);
    expect(result.tableSql).toBeDefined();
  });

  it('creates table with raw NOW() default timestamp', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['test-event']);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('test-event');
      expect(rows[0].createdAt).toBeDefined();
      expect(typeof rows[0].createdAt).toBe('string');
      expect((rows[0].createdAt as string).length).toBeGreaterThan(0);
    } finally {
      await closeDb(db);
    }
  });

  it('handles multiple inserts with consistent NOW() behavior', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-1']);
      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-2']);
      await runSql(db, `INSERT INTO ${Events.name} (name) VALUES (?);`, ['event-3']);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name} ORDER BY id`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(3);
      expect(rows[0].name).toBe('event-1');
      expect(rows[1].name).toBe('event-2');
      expect(rows[2].name).toBe('event-3');

      for (const row of rows) {
        expect(row.createdAt).toBeDefined();
        expect(typeof row.createdAt).toBe('string');
      }
    } finally {
      await closeDb(db);
    }
  });

  it('allows explicit override of createdAt', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      const customDate = '2020-01-01 00:00:00';
      await runSql(db, `INSERT INTO ${Events.name} (name, createdAt) VALUES (?, ?);`, ['custom-event', customDate]);

      const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`SELECT id, name, createdAt FROM ${Events.name}`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('custom-event');
      expect(rows[0].createdAt).toBe(customDate);
    } finally {
      await closeDb(db);
    }
  });

  it('correctly generates schema with raw NOW() default', async () => {
    const db = new sqlite3.Database(':memory:');
    const session = createSqliteSessionFromDb(db);

    try {
      await executeSchemaSqlFor(session.executor, new SQLiteSchemaDialect(), Events);

      const tableInfo = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        db.all(`PRAGMA table_info(${Events.name})`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as Record<string, unknown>[]);
        });
      });

      const createdAtColumn = tableInfo.find((col: Record<string, unknown>) => col.name === 'createdAt');
      expect(createdAtColumn).toBeDefined();
      expect(createdAtColumn.type).toBe('TEXT');
      expect(createdAtColumn.notnull).toBe(0);
    } finally {
      await closeDb(db);
    }
  });
});
