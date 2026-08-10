import { beforeEach, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { eq } from '../../../src/core/ast/expression.js';
import { col } from '../../../src/schema/column-types.js';
import type { BelongsToReference, ManyToManyCollection } from '../../../src/schema/types.js';
import {
  BelongsTo,
  BelongsToMany,
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
  entityRef,
  selectFromEntity
} from '../../../src/decorators/index.js';

@Entity({ tableName: 'cp_usuario' })
class Usuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  nome?: string;
}

@Entity({ tableName: 'cp_afastamento_pessoa' })
class AfastamentoPessoa {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @BelongsToMany({
    target: () => Usuario,
    pivotTable: () => AfastamentoPessoaUsuario,
    pivotForeignKeyToRoot: 'afastamento_pessoa_id',
    pivotForeignKeyToTarget: 'usuario_id'
  })
  substitutos!: ManyToManyCollection<Usuario>;
}

@Entity({ tableName: 'cp_afastamento_pessoa_usuario' })
class AfastamentoPessoaUsuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  afastamento_pessoa_id!: number;

  @Column(col.notNull(col.int()))
  usuario_id!: number;

  @BelongsTo({ target: () => AfastamentoPessoa, foreignKey: 'afastamento_pessoa_id' })
  afastamentoPessoa!: BelongsToReference<AfastamentoPessoa>;

  @BelongsTo({ target: () => Usuario, foreignKey: 'usuario_id' })
  usuario!: BelongsToReference<Usuario>;
}

const ROOT_ID = 10;
const PIVOT_COUNT = 3;

describeMssql('Metal ORM count pagination (mssql)', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  beforeEach(async () => {
    bootstrapEntities();
    ({ executor, session } = await getSetup());

    await executor.executeSql(`
      IF OBJECT_ID('dbo.cp_afastamento_pessoa_usuario', 'U') IS NOT NULL DROP TABLE dbo.cp_afastamento_pessoa_usuario;
      IF OBJECT_ID('dbo.cp_afastamento_pessoa', 'U') IS NOT NULL DROP TABLE dbo.cp_afastamento_pessoa;
      IF OBJECT_ID('dbo.cp_usuario', 'U') IS NOT NULL DROP TABLE dbo.cp_usuario;

      CREATE TABLE dbo.cp_usuario (
        id INT NOT NULL PRIMARY KEY,
        nome VARCHAR(255)
      );
      CREATE TABLE dbo.cp_afastamento_pessoa (
        id INT NOT NULL PRIMARY KEY
      );
      CREATE TABLE dbo.cp_afastamento_pessoa_usuario (
        id INT NOT NULL PRIMARY KEY,
        afastamento_pessoa_id INT NOT NULL,
        usuario_id INT NOT NULL
      );

      INSERT INTO dbo.cp_usuario (id, nome) VALUES (1, 'Ana'), (2, 'Bruno'), (3, 'Carla');
      INSERT INTO dbo.cp_afastamento_pessoa (id) VALUES (10), (20);
      INSERT INTO dbo.cp_afastamento_pessoa_usuario (id, afastamento_pessoa_id, usuario_id) VALUES
        (1, 10, 1),
        (2, 10, 2),
        (3, 10, 3),
        (4, 20, 1);
    `);
  });

  it('count() returns distinct root count while countRows() returns joined row count', async () => {
    const afastamentoRef = entityRef(AfastamentoPessoa);

    const query = selectFromEntity(AfastamentoPessoa)
      .include('substitutos', { columns: ['id'] })
      .where(eq(afastamentoRef.id, ROOT_ID));

    const distinctCount = await query.count(session);
    const rowCount = await query.countRows(session);

    expect(distinctCount).toBe(1);
    expect(rowCount).toBe(PIVOT_COUNT);
    expect(rowCount).toBeGreaterThan(distinctCount);
  });

  it('executePaged uses distinct count for totalItems', async () => {
    const afastamentoRef = entityRef(AfastamentoPessoa);
    const query = selectFromEntity(AfastamentoPessoa)
      .include('substitutos', { columns: ['id'] })
      .where(eq(afastamentoRef.id, ROOT_ID));

    const result = await query.executePaged(session, { page: 1, pageSize: 1 });

    expect(result.totalItems).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
