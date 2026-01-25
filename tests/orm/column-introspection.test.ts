import { afterEach, describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { Column, Entity, PrimaryKey } from '../../src/decorators/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { getColumnType, getDateKind } from '../../src/orm/column-introspection.js';

afterEach(() => {
  clearEntityMetadata();
});

describe('column introspection', () => {
  it('normalizes table column types', () => {
    const table = defineTable('nota_versao', {
      id: col.primaryKey(col.int()),
      data: col.date<Date>(),
      data_exclusao: col.datetime<Date>(),
      created_at: col.timestamp(),
      custom: col.custom('citext')
    });

    expect(getColumnType(table, 'data')).toBe('date');
    expect(getColumnType(table, 'data_exclusao')).toBe('datetime');
    expect(getColumnType(table, 'custom')).toBe('citext');
    expect(getDateKind(table, 'data')).toBe('date');
    expect(getDateKind(table, 'created_at')).toBe('date-time');
    expect(getDateKind(table, 'custom')).toBeUndefined();
    expect(getColumnType(table, 'missing')).toBeUndefined();
  });

  it('reads decorator entity metadata', () => {
    @Entity({ tableName: 'nota_versao' })
    class NotaVersao {
      @PrimaryKey(col.int())
      id = 0;

      @Column(col.date<Date>())
      data!: Date;

      @Column(col.datetime<Date>())
      data_exclusao?: Date;
    }

    expect(getColumnType(NotaVersao, 'data')).toBe('date');
    expect(getDateKind(NotaVersao, 'data')).toBe('date');
    expect(getDateKind(NotaVersao, 'data_exclusao')).toBe('date-time');
    expect(getColumnType(NotaVersao, 'missing')).toBeUndefined();
  });
});
