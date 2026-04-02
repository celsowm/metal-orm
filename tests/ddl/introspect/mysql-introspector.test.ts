import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbExecutor } from '../../../src/core/execution/db-executor.js';
import type { IntrospectOptions } from '../../../src/core/ddl/introspect/types.js';
import { mysqlIntrospector } from '../../../src/core/ddl/introspect/mysql.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';

const sqlCalls: string[] = [];
let responseQueue: Record<string, unknown>[][] = [];

vi.mock('../../../src/core/ddl/introspect/utils.js', async () => {
  const actual = await vi.importActual('../../../src/core/ddl/introspect/utils.js');
  return {
    ...actual,
    queryRows: async function (_executor, sql) {
      sqlCalls.push(sql ?? '');
      return responseQueue.shift() ?? [];
    },
  };
});

beforeEach(() => {
  sqlCalls.length = 0;
  responseQueue = [];
});

describe('mysqlIntrospector', () => {
  it('captures comments, foreign keys, and indexes', async () => {
    const tableRows: Record<string, unknown>[] = [
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        TABLE_COMMENT: 'Tabela de acervos'
      }
    ];

    const columnRows: Record<string, unknown>[] = [
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'id',
        COLUMN_TYPE: 'int',
        DATA_TYPE: 'int',
        IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: null,
        EXTRA: 'auto_increment',
        COLUMN_COMMENT: 'PK acervo'
      },
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'nome',
        COLUMN_TYPE: 'varchar(125)',
        DATA_TYPE: 'varchar',
        IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: 'Acervo 1',
        EXTRA: null,
        COLUMN_COMMENT: 'Nome do acervo'
      },
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'ativo',
        COLUMN_TYPE: 'tinyint(1)',
        DATA_TYPE: 'tinyint',
        IS_NULLABLE: 'NO',
        COLUMN_DEFAULT: '1',
        EXTRA: null,
        COLUMN_COMMENT: 'Flag ativo'
      },
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'equipe_responsavel_id',
        COLUMN_TYPE: 'int',
        DATA_TYPE: 'int',
        IS_NULLABLE: 'YES',
        COLUMN_DEFAULT: null,
        EXTRA: null,
        COLUMN_COMMENT: 'FK equipe'
      }
    ];

    const pkRows: Record<string, unknown>[] = [
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'id'
      }
    ];

    const fkRows: Record<string, unknown>[] = [
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        COLUMN_NAME: 'equipe_responsavel_id',
        CONSTRAINT_NAME: 'fk_equipe',
        REFERENCED_TABLE_SCHEMA: 'public',
        REFERENCED_TABLE_NAME: 'equipe',
        REFERENCED_COLUMN_NAME: 'id',
        DELETE_RULE: 'CASCADE',
        UPDATE_RULE: 'NO ACTION'
      }
    ];

    const indexRows: Record<string, unknown>[] = [
      {
        TABLE_SCHEMA: 'public',
        TABLE_NAME: 'acervo',
        INDEX_NAME: 'UC_acervo_ativo',
        NON_UNIQUE: 0,
        COLS: 'nome,ativo'
      }
    ];

    responseQueue = [tableRows, columnRows, pkRows, fkRows, indexRows];

    const schema = await mysqlIntrospector.introspect(
      {
        executor: {} as DbExecutor,
        dialect: new MySqlDialect()
      },
      { schema: 'public' } satisfies IntrospectOptions
    );

    expect(sqlCalls).toHaveLength(5);
    expect(schema.tables).toHaveLength(1);

    const table = schema.tables[0];
    expect(table.comment).toBe('Tabela de acervos');
    expect(table.schema).toBe('public');

    const nomeColumn = table.columns.find(c => c.name === 'nome');
    expect(nomeColumn).toMatchObject({
      type: 'varchar(125)',
      comment: 'Nome do acervo',
      default: 'Acervo 1'
    });

    const ativoColumn = table.columns.find(c => c.name === 'ativo');
    expect(ativoColumn?.type).toBe('tinyint(1)');

    const fkColumn = table.columns.find(c => c.name === 'equipe_responsavel_id');
    expect(fkColumn?.references).toMatchObject({
      table: 'public.equipe',
      column: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'NO ACTION',
      name: 'fk_equipe'
    });

    const index = table.indexes?.find(i => i.name === 'UC_acervo_ativo');
    expect(index?.columns.map(col => col.column)).toEqual(['nome', 'ativo']);
    expect(index?.unique).toBe(true);
  });
});
