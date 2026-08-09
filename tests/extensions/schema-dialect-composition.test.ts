import { describe, expect, it } from 'vitest';
import { composeSchemaDialect } from '../../src/core/ddl/schema-dialect-composer.js';
import { createLiteralFormatter } from '../../src/core/ddl/sql-writing.js';
import { diffSchema } from '../../src/core/ddl/schema-diff.js';
import { createSqliteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import type { TableDef } from '../../src/schema/table.js';
import type { DatabaseSchema } from '../../src/core/ddl/schema-types.js';

const usersTable: TableDef = {
  name: 'users',
  columns: {
    id: { name: 'id', type: 'INT', primary: true, notNull: true },
    active: { name: 'active', type: 'BOOLEAN', notNull: true }
  },
  relations: {},
  primaryKey: ['id']
};

describe('schema dialect composition', () => {
  it('creates a structural schema dialect without inheritance', () => {
    const dialect = composeSchemaDialect({
      name: 'oracle',
      quoteIdentifier: id => `"${id}"`,
      literalFormatter: createLiteralFormatter(),
      renderColumnType: () => 'NUMBER',
      renderAutoIncrement: () => undefined,
      renderIndex: (table, index, services) =>
        `CREATE INDEX ${services.quoteIdentifier(index.name ?? 'idx')} ON ${services.formatTableName(table)} (${index.columns.map(column => services.quoteIdentifier(typeof column === 'string' ? column : column.column)).join(', ')});`
    });

    expect(dialect.name).toBe('oracle');
    expect(dialect.renderColumnType(usersTable.columns.id)).toBe('NUMBER');
    expect(dialect.mutations).toEqual({});
  });

  it('does not crash when a destructive capability is absent', () => {
    const dialect = composeSchemaDialect({
      name: 'oracle',
      quoteIdentifier: id => `"${id}"`,
      literalFormatter: createLiteralFormatter(),
      renderColumnType: () => 'integer',
      renderAutoIncrement: () => undefined,
      renderIndex: () => 'CREATE INDEX ignored;'
    });

    const actual: DatabaseSchema = {
      tables: [{
        name: 'users',
        columns: [
          { name: 'id', type: 'integer', notNull: true },
          { name: 'legacy', type: 'integer', notNull: false }
        ],
        primaryKey: ['id']
      }]
    };

    const expected: TableDef = {
      name: 'users',
      columns: { id: { name: 'id', type: 'INT', primary: true, notNull: true } },
      relations: {},
      primaryKey: ['id']
    };

    const plan = diffSchema([expected], actual, dialect, { allowDestructive: true });
    const drop = plan.changes.find(change => change.kind === 'dropColumn');

    expect(drop?.statements).toEqual([]);
    expect(plan.warnings.some(warning => /does not provide the DROP COLUMN capability/i.test(warning))).toBe(true);
  });

  it('renders SQLite partial indexes', () => {
    const dialect = createSqliteSchemaDialect();

    expect(dialect.supportsPartialIndexes()).toBe(true);
    expect(dialect.renderIndex(usersTable, {
      name: 'idx_users_active',
      columns: ['id'],
      where: 'active = 1'
    })).toBe(
      'CREATE INDEX IF NOT EXISTS "idx_users_active" ON "users" ("id") WHERE active = 1;'
    );
  });
});
