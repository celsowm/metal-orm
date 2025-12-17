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
        table_schema: 'public',
        table_name: 'acervo',
        table_comment: 'Tabela de acervos'
      }
    ];

    const columnRows: Record<string, unknown>[] = [
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'id',
        column_type: 'int',
        data_type: 'int',
        is_nullable: 'NO',
        column_default: null,
        extra: 'auto_increment',
        column_comment: 'PK acervo'
      },
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'nome',
        column_type: 'varchar(125)',
        data_type: 'varchar',
        is_nullable: 'NO',
        column_default: 'Acervo 1',
        extra: null,
        column_comment: 'Nome do acervo'
      },
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'ativo',
        column_type: 'tinyint(1)',
        data_type: 'tinyint',
        is_nullable: 'NO',
        column_default: '1',
        extra: null,
        column_comment: 'Flag ativo'
      },
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'equipe_responsavel_id',
        column_type: 'int',
        data_type: 'int',
        is_nullable: 'YES',
        column_default: null,
        extra: null,
        column_comment: 'FK equipe'
      }
    ];

    const pkRows: Record<string, unknown>[] = [
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'id'
      }
    ];

    const fkRows: Record<string, unknown>[] = [
      {
        table_schema: 'public',
        table_name: 'acervo',
        column_name: 'equipe_responsavel_id',
        constraint_name: 'fk_equipe',
        referenced_table_schema: 'public',
        referenced_table_name: 'equipe',
        referenced_column_name: 'id',
        delete_rule: 'CASCADE',
        update_rule: 'NO ACTION'
      }
    ];

    const indexRows: Record<string, unknown>[] = [
      {
        table_schema: 'public',
        table_name: 'acervo',
        index_name: 'UC_acervo_ativo',
        non_unique: 0,
        cols: 'nome,ativo'
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
