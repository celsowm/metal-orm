import { test, expect } from 'vitest';
import { renderEntityFile } from '../../../scripts/generate-entities/render.mjs';

test('sanitizes column names with spaces to valid TypeScript property names', () => {
  const schema = {
    tables: [
      {
        name: 'tabela_exito_tj',
        schema: 'dbo',
        columns: [
          { name: 'desc_ Assunto', type: 'nvarchar(510)', notNull: false, default: undefined },
          { name: 'normal_column', type: 'int', notNull: true, default: undefined },
          { name: '1startsWithNumber', type: 'int', notNull: false, default: undefined },
          { name: 'has-dash', type: 'int', notNull: false, default: undefined },
          { name: 'has.special@chars', type: 'int', notNull: false, default: undefined }
        ],
        primaryKey: [],
        indexes: []
      }
    ]
  };

  const result = renderEntityFile(schema, {});

  // desc_ Assunto becomes desc__Assunto (space replaced with underscore)
  expect(result).toContain('desc__Assunto?: string;');
  expect(result).toContain("name: 'desc_ Assunto'");
  expect(result).toContain('normal_column!: number;');
  expect(result).toContain('_1startsWithNumber?: number;');
  expect(result).toContain('has_dash?: number;');
  expect(result).toContain('has_special_chars?: number;');

  // The original column names should be preserved in the decorator with 'name:' option
  expect(result).toContain("name: '1startsWithNumber'");
  expect(result).toContain("name: 'has-dash'");
  expect(result).toContain("name: 'has.special@chars'");
});
