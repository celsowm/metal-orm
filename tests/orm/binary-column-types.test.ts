import { describe, expect, it } from 'vitest';
import { col, type ColumnDef } from '../../src/schema/column.js';
import {
  MSSqlSchemaDialect,
  MySqlSchemaDialect,
  PostgresSchemaDialect,
  SQLiteSchemaDialect
} from '../../src/core/ddl/dialects/index.js';

const column = (type: ColumnDef['type'], args?: any[]): ColumnDef => ({
  name: 'payload',
  type,
  args
});

describe('binary column types', () => {
  it('exposes helpers for binary definitions', () => {
    expect(col.blob().type).toBe('BLOB');
    expect(col.binary(8)).toEqual({ name: '', type: 'BINARY', args: [8] });
    expect(col.varbinary().args).toBeUndefined();
    expect(col.bytea().type).toBe('BYTEA');
  });

  it('renders sqlite binary affinity as BLOB', () => {
    const dialect = new SQLiteSchemaDialect();
    expect(dialect.renderColumnType(column('BLOB'))).toBe('BLOB');
    expect(dialect.renderColumnType(column('VARBINARY'))).toBe('BLOB');
  });

  it('renders postgres binary columns as bytea', () => {
    const dialect = new PostgresSchemaDialect();
    expect(dialect.renderColumnType(column('BYTEA'))).toBe('bytea');
    expect(dialect.renderColumnType(column('BLOB'))).toBe('bytea');
  });

  it('renders mysql binary column variants', () => {
    const dialect = new MySqlSchemaDialect();
    expect(dialect.renderColumnType(column('BLOB'))).toBe('BLOB');
    expect(dialect.renderColumnType(column('VARBINARY', [128]))).toBe('VARBINARY(128)');
    expect(dialect.renderColumnType(column('BINARY'))).toBe('BINARY(255)');
  });

  it('renders mssql binary column variants', () => {
    const dialect = new MSSqlSchemaDialect();
    expect(dialect.renderColumnType(column('BLOB'))).toBe('VARBINARY(MAX)');
    expect(dialect.renderColumnType(column('VARBINARY', [512]))).toBe('VARBINARY(512)');
    expect(dialect.renderColumnType(column('BINARY', [16]))).toBe('BINARY(16)');
  });
});
