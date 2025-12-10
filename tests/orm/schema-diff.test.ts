import { describe, it, expect, vi } from 'vitest';
import { diffSchema, synchronizeSchema } from '../../src/core/ddl/schema-diff.js';
import { PostgresSchemaDialect, SQLiteSchemaDialect } from '../../src/core/ddl/dialects/index.js';
import { TableDef } from '../../src/schema/table.js';
import { DatabaseSchema } from '../../src/core/ddl/schema-types.js';

const postgresDialect = new PostgresSchemaDialect();
const sqliteDialect = new SQLiteSchemaDialect();

const makeExpectedTable = (): TableDef => ({
  name: 'users',
  columns: {
    id: { name: 'id', type: 'INT', primary: true, notNull: true, autoIncrement: true, generated: 'byDefault' },
    age: { name: 'age', type: 'INT', notNull: true, default: 0 }
  },
  relations: {},
  primaryKey: ['id']
});

const makeActualSchema = (): DatabaseSchema => ({
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'integer', notNull: true, autoIncrement: false },
        { name: 'age', type: 'text', notNull: false, default: null }
      ],
      primaryKey: ['id']
    }
  ]
});

describe('schema diff alterColumn support', () => {
  it('emits alterColumn statements for postgres when column attributes change', () => {
    const expected = [makeExpectedTable()];
    const actual = makeActualSchema();

    const plan = diffSchema(expected, actual, postgresDialect);

    const alters = plan.changes.filter(change => change.kind === 'alterColumn');
    expect(alters.length).toBeGreaterThan(0);
    // Should produce concrete ALTER statements (type/default/nullability/identity)
    expect(alters.every(change => change.statements.length > 0)).toBe(true);
    const sqlText = alters.flatMap(c => c.statements).join('\n');
    expect(sqlText).toContain('ALTER TABLE "users" ALTER COLUMN "age" TYPE');
    expect(sqlText).toMatch(/ALTER COLUMN "age" SET DEFAULT/);
    expect(sqlText).toMatch(/ALTER COLUMN "age" SET NOT NULL/);
  });

  it('produces warnings when dialect cannot alter columns (sqlite)', () => {
    const expected = [makeExpectedTable()];
    const actual = makeActualSchema();

    const plan = diffSchema(expected, actual, sqliteDialect);

    expect(plan.changes.find(c => c.kind === 'alterColumn')).toBeUndefined();
    expect(plan.warnings.some(w => /SQLite ALTER COLUMN is not supported/i.test(w))).toBe(true);
  });

  it('executes only safe changes when destructive operations are disallowed', async () => {
    const expected = [makeExpectedTable()];
    const actual: DatabaseSchema = { tables: [] };

    const mockExecuteSql = vi.fn().mockResolvedValue([]);
    const executor = { executeSql: mockExecuteSql };

    const plan = await synchronizeSchema(expected, actual, postgresDialect, executor as any, {
      allowDestructive: false
    });

    const executedSql = mockExecuteSql.mock.calls.map(args => args[0] as string);
    expect(executedSql.length).toBeGreaterThan(0);
    expect(plan.changes.some(c => !c.safe)).toBe(false);
  });

  it('honors dryRun by not executing any statements', async () => {
    const expected = [makeExpectedTable()];
    const actual: DatabaseSchema = { tables: [] };

    const mockExecuteSql = vi.fn().mockResolvedValue([]);
    const executor = { executeSql: mockExecuteSql };

    const plan = await synchronizeSchema(expected, actual, postgresDialect, executor as any, {
      dryRun: true,
      allowDestructive: true
    });

    expect(plan.changes.length).toBeGreaterThan(0);
    expect(mockExecuteSql).not.toHaveBeenCalled();
  });
});
