import { describe, it, expect } from 'vitest';
import {
  InsertQueryBuilder,
  UpdateQueryBuilder,
  DeleteQueryBuilder,
  SelectQueryBuilder
} from '../../src/index.js';
import { Dialect } from '../../src/core/dialect/abstract.js';
import { MySqlDialect } from '../../src/core/dialect/mysql/index.js';
import { PostgresDialect } from '../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Users, Orders, Profiles } from '../fixtures/schema.js';
import { eq } from '../../src/core/ast/expression.js';
import type { ColumnDef } from '../../src/schema/column-types.js';

type Row = {
  name: string;
  role: string;
};

interface DialectCase {
  name: string;
  dialect: Dialect;
  placeholder: (index: number) => string;
  supportsReturning: boolean;
}

const rowOrder: (keyof Row)[] = ['name', 'role'];
const insertRows: Row[] = [
  { name: 'alice', role: 'admin' },
  { name: 'bob', role: 'user' }
];

const returningColumns: ColumnDef[] = [Users.columns.id, Users.columns.name];
const columnColumns: ColumnDef[] = [Users.columns.name, Users.columns.role];

const dialectCases: DialectCase[] = [
  {
    name: 'MySQL',
    dialect: new MySqlDialect(),
    placeholder: () => '?',
    supportsReturning: false
  },
  {
    name: 'Postgres',
    dialect: new PostgresDialect(),
    placeholder: index => `$${index}`,
    supportsReturning: true
  },
  {
    name: 'SQLite',
    dialect: new SqliteDialect(),
    placeholder: () => '?',
    supportsReturning: true
  },
  {
    name: 'SQL Server',
    dialect: new SqlServerDialect(),
    placeholder: index => `@p${index}`,
    supportsReturning: false
  }
];

const renderDmlColumn = (dialectCase: DialectCase, column: ColumnDef): string => {
  return dialectCase.dialect.quoteIdentifier(column.name);
};

const buildColumnList = (dialectCase: DialectCase, columns: ColumnDef[]): string =>
  columns.map(column => renderDmlColumn(dialectCase, column)).join(', ');

const buildReturningClause = (dialectCase: DialectCase, columns: ColumnDef[]): string => {
  if (columns.length === 0) return '';
  const dialect = dialectCase.dialect;
  const parts = columns.map(column => {
    if (dialectCase.name === 'SQLite') {
      return dialect.quoteIdentifier(column.name);
    }
    const table = dialect.quoteIdentifier(column.table || Users.name);
    return `${table}.${dialect.quoteIdentifier(column.name)}`;
  });
  return ` RETURNING ${parts.join(', ')}`;
};

const qualifyColumn = (dialect: Dialect, column: ColumnDef): string =>
  `${dialect.quoteIdentifier(column.table || Users.name)}.${dialect.quoteIdentifier(column.name)}`;

const qualifyUpdateColumn = (dialect: Dialect, column: ColumnDef): string => {
  if (dialect instanceof SqliteDialect) {
    return dialect.quoteIdentifier(column.name);
  }
  return qualifyColumn(dialect, column);
};

const buildValuesClause = (dialectCase: DialectCase, columnCount: number, rowCount: number): string => {
  let index = 1;
  const segments: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const placeholders: string[] = [];
    for (let col = 0; col < columnCount; col += 1) {
      placeholders.push(dialectCase.placeholder(index));
      index += 1;
    }
    segments.push(`(${placeholders.join(', ')})`);
  }
  return segments.join(', ');
};

const buildPlaceholderSequence = (dialectCase: DialectCase, count: number, startIndex = 1): string[] =>
  Array.from({ length: count }, (_, idx) => dialectCase.placeholder(startIndex + idx));

const flattenRowValues = (rows: Row[], order: (keyof Row)[]): unknown[] =>
  rows.flatMap(row => order.map(key => row[key]));

const stripTrailingSemicolon = (sql: string): string => sql.replace(/;$/, '');

describe('DML builders', () => {
  dialectCases.forEach(dialectCase => {
    describe(dialectCase.name, () => {
      const dialect = dialectCase.dialect;
      const tableName = Users.name;
      const qualifiedColumns = buildColumnList(dialectCase, columnColumns);
      const returningSql = buildReturningClause(dialectCase, returningColumns);

      it('compiles single-row insert', () => {
        const query = new InsertQueryBuilder(Users).values(insertRows[0]);
        const compiled = query.compile(dialect);
        const valueClause = `(${dialectCase.placeholder(1)}, ${dialectCase.placeholder(2)})`;
        const expectedSql = `INSERT INTO ${dialect.quoteIdentifier(tableName)} (${qualifiedColumns}) VALUES ${valueClause};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual([insertRows[0].name, insertRows[0].role]);
      });

      it('compiles multi-row insert with consistent parameter order', () => {
        const query = new InsertQueryBuilder(Users).values(insertRows);
        const compiled = query.compile(dialect);
        const valuesClause = buildValuesClause(dialectCase, columnColumns.length, insertRows.length);
        const expectedSql = `INSERT INTO ${dialect.quoteIdentifier(tableName)} (${qualifiedColumns}) VALUES ${valuesClause};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual(flattenRowValues(insertRows, rowOrder));
      });

      if (dialectCase.supportsReturning) {
        it('appends RETURNING for insert when requested', () => {
          const query = new InsertQueryBuilder(Users)
            .values(insertRows[0])
            .returning(Users.columns.id, Users.columns.name);
          const compiled = query.compile(dialect);
          const valueClause = `(${dialectCase.placeholder(1)}, ${dialectCase.placeholder(2)})`;
          const expectedSql = `INSERT INTO ${dialect.quoteIdentifier(tableName)} (${qualifiedColumns}) VALUES ${valueClause}${returningSql};`;
          expect(compiled.sql).toBe(expectedSql);
          expect(compiled.params).toEqual([insertRows[0].name, insertRows[0].role]);
        });
      }

      it('compiles update with SET values', () => {
        const updateValues = { name: 'ali', role: 'builder' };
        const query = new UpdateQueryBuilder(Users).set(updateValues);
        const compiled = query.compile(dialect);
        const placeholderSeq = buildPlaceholderSequence(dialectCase, columnColumns.length);
        const assignments = columnColumns
        .map((column, idx) => `${qualifyUpdateColumn(dialect, column)} = ${placeholderSeq[idx]}`)
          .join(', ');
        const expectedSql = `UPDATE ${dialect.quoteIdentifier(tableName)} SET ${assignments};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual([updateValues.name, updateValues.role]);
      });

      it('compiles update with WHERE clause', () => {
        const updateValues = { name: 'gold', role: 'star' };
        const query = new UpdateQueryBuilder(Users)
          .set(updateValues)
          .where(eq(Users.columns.id, 1));
        const compiled = query.compile(dialect);
        const assignmentPlaceholders = buildPlaceholderSequence(dialectCase, columnColumns.length);
        const assignments = columnColumns
          .map((column, idx) => `${qualifyUpdateColumn(dialect, column)} = ${assignmentPlaceholders[idx]}`)
          .join(', ');
        const wherePlaceholder = dialectCase.placeholder(columnColumns.length + 1);
        const whereClause = ` WHERE ${qualifyColumn(dialect, Users.columns.id)} = ${wherePlaceholder}`;
        const expectedSql = `UPDATE ${dialect.quoteIdentifier(tableName)} SET ${assignments}${whereClause};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual([updateValues.name, updateValues.role, 1]);
      });

      if (dialectCase.supportsReturning) {
        it('appends RETURNING for update when requested', () => {
        const query = new UpdateQueryBuilder(Users)
          .set({ name: 'return' })
          .returning(Users.columns.id, Users.columns.name);
        const compiled = query.compile(dialect);
        const placeholder = dialectCase.placeholder(1);
        const assignment = `${qualifyUpdateColumn(dialect, Users.columns.name)} = ${placeholder}`;
        const expectedSql = `UPDATE ${dialect.quoteIdentifier(tableName)} SET ${assignment}${returningSql};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual(['return']);
      });
      }

      it('compiles DELETE without WHERE', () => {
        const query = new DeleteQueryBuilder(Users);
        const compiled = query.compile(dialect);
        const prefix = dialectCase.name === 'SQL Server'
          ? `DELETE ${dialect.quoteIdentifier(tableName)} FROM ${dialect.quoteIdentifier(tableName)}`
          : `DELETE FROM ${dialect.quoteIdentifier(tableName)}`;
        const expectedSql = `${prefix};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual([]);
      });

      it('compiles DELETE with WHERE clause', () => {
        const query = new DeleteQueryBuilder(Users).where(eq(Users.columns.id, 7));
        const compiled = query.compile(dialect);
        const wherePlaceholder = dialectCase.placeholder(1);
        const whereClause = ` WHERE ${qualifyColumn(dialect, Users.columns.id)} = ${wherePlaceholder}`;
        const prefix = dialectCase.name === 'SQL Server'
          ? `DELETE ${dialect.quoteIdentifier(tableName)} FROM ${dialect.quoteIdentifier(tableName)}`
          : `DELETE FROM ${dialect.quoteIdentifier(tableName)}`;
        const expectedSql = `${prefix}${whereClause};`;
        expect(compiled.sql).toBe(expectedSql);
        expect(compiled.params).toEqual([7]);
      });

      if (dialectCase.supportsReturning) {
        it('appends RETURNING for delete when requested', () => {
          const query = new DeleteQueryBuilder(Users)
            .where(eq(Users.columns.id, 11))
            .returning(Users.columns.id, Users.columns.name);
          const compiled = query.compile(dialect);
          const wherePlaceholder = dialectCase.placeholder(1);
          const whereClause = ` WHERE ${qualifyColumn(dialect, Users.columns.id)} = ${wherePlaceholder}`;
          const expectedSql = `DELETE FROM ${dialect.quoteIdentifier(tableName)}${whereClause}${returningSql};`;
          expect(compiled.sql).toBe(expectedSql);
          expect(compiled.params).toEqual([11]);
        });
      }
    });
  });
});

describe('Advanced DML forms', () => {
  it('compiles INSERT ... SELECT sources', () => {
    const dialect = new PostgresDialect();
    const select = new SelectQueryBuilder(Orders)
      .select({
        id: Orders.columns.user_id,
        role: Orders.columns.status
      });
    const query = new InsertQueryBuilder(Users)
      .columns(Users.columns.id, Users.columns.role)
      .fromSelect(select);
    const compiled = query.compile(dialect);
    const selectSql = stripTrailingSemicolon(select.compile(dialect).sql);
    const columnList = [Users.columns.id, Users.columns.role]
      .map(column => dialect.quoteIdentifier(column.name))
      .join(', ');
    const expectedSql = `INSERT INTO ${dialect.quoteIdentifier(Users.name)} (${columnList}) ${selectSql};`;
    expect(compiled.sql).toBe(expectedSql);
  });

  it('compiles UPDATE with FROM and JOIN clauses', () => {
    const dialect = new PostgresDialect();
    const query = new UpdateQueryBuilder(Users)
      .set({ role: 'vip' })
      .from(Orders)
      .join(Profiles, eq(Profiles.columns.user_id, Orders.columns.user_id))
      .where(eq(Users.columns.id, Orders.columns.user_id));
    const compiled = query.compile(dialect);
    const placeholder = '$1';
    const target = dialect.quoteIdentifier(Users.name);
    const setClause = `${qualifyUpdateColumn(dialect, Users.columns.role)} = ${placeholder}`;
    const fromClause = ` FROM ${dialect.quoteIdentifier(Orders.name)} INNER JOIN ${dialect.quoteIdentifier(Profiles.name)} ON ${qualifyColumn(dialect, Profiles.columns.user_id)} = ${qualifyColumn(dialect, Orders.columns.user_id)}`;
    const whereClause = ` WHERE ${qualifyColumn(dialect, Users.columns.id)} = ${qualifyColumn(dialect, Orders.columns.user_id)}`;
    const expectedSql = `UPDATE ${target} SET ${setClause}${fromClause}${whereClause};`;
    expect(compiled.sql).toBe(expectedSql);
    expect(compiled.params).toEqual(['vip']);
  });

  it('compiles DELETE with USING and JOIN clauses', () => {
    const dialect = new PostgresDialect();
    const query = new DeleteQueryBuilder(Users)
      .using(Orders)
      .join(Profiles, eq(Profiles.columns.user_id, Orders.columns.user_id))
      .where(eq(Orders.columns.status, 'complete'));
    const compiled = query.compile(dialect);
    const placeholder = '$1';
    const expectedSql = `DELETE FROM ${dialect.quoteIdentifier(Users.name)} USING ${dialect.quoteIdentifier(Orders.name)} INNER JOIN ${dialect.quoteIdentifier(Profiles.name)} ON ${qualifyColumn(dialect, Profiles.columns.user_id)} = ${qualifyColumn(dialect, Orders.columns.user_id)} WHERE ${qualifyColumn(dialect, Orders.columns.status)} = ${placeholder};`;
    expect(compiled.sql).toBe(expectedSql);
    expect(compiled.params).toEqual(['complete']);
  });

  it('compiles DELETE ... JOIN on SQL Server without USING', () => {
    const dialect = new SqlServerDialect();
    const query = new DeleteQueryBuilder(Users)
      .join(Orders, eq(Orders.columns.user_id, Users.columns.id))
      .where(eq(Orders.columns.status, 'billed'));
    const compiled = query.compile(dialect);
    const placeholder = '@p1';
    const expectedSql = `DELETE ${dialect.quoteIdentifier(Users.name)} FROM ${dialect.quoteIdentifier(Users.name)} INNER JOIN ${dialect.quoteIdentifier(Orders.name)} ON ${qualifyColumn(dialect, Orders.columns.user_id)} = ${qualifyColumn(dialect, Users.columns.id)} WHERE ${qualifyColumn(dialect, Orders.columns.status)} = ${placeholder};`;
    expect(compiled.sql).toBe(expectedSql);
    expect(compiled.params).toEqual(['billed']);
  });
});


