import { beforeEach, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { eq, isNotNull, or } from '../../../src/core/ast/expression.js';
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

@Entity({ tableName: 'pivot_usuario' })
class Usuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  nome?: string;
}

@Entity({ tableName: 'pivot_afastamento_pessoa' })
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

@Entity({ tableName: 'pivot_afastamento_pessoa_usuario' })
class AfastamentoPessoaUsuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  afastamento_pessoa_id!: number;

  @Column(col.notNull(col.int()))
  usuario_id!: number;

  @Column(col.boolean())
  usa_equipe_acervo_substituto?: boolean;

  @Column(col.text())
  final_codigo_pa?: string;

  @BelongsTo({ target: () => AfastamentoPessoa, foreignKey: 'afastamento_pessoa_id' })
  afastamentoPessoa!: BelongsToReference<AfastamentoPessoa>;

  @BelongsTo({ target: () => Usuario, foreignKey: 'usuario_id' })
  usuario!: BelongsToReference<Usuario>;
}

describeMssql('Metal ORM pivot hydration (mssql)', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  type PivotRow = {
    afastamento_pessoa_id: number;
    usuario_id: number;
    usa?: boolean | null;
    final?: string | null;
  };

  beforeEach(async () => {
    bootstrapEntities();
    ({ executor, session } = await getSetup());

    await executor.executeSql(`
      IF OBJECT_ID('dbo.pivot_afastamento_pessoa_usuario', 'U') IS NOT NULL DROP TABLE dbo.pivot_afastamento_pessoa_usuario;
      IF OBJECT_ID('dbo.pivot_afastamento_pessoa', 'U') IS NOT NULL DROP TABLE dbo.pivot_afastamento_pessoa;
      IF OBJECT_ID('dbo.pivot_usuario', 'U') IS NOT NULL DROP TABLE dbo.pivot_usuario;

      CREATE TABLE dbo.pivot_usuario (
        id INT NOT NULL PRIMARY KEY,
        nome VARCHAR(255)
      );
      CREATE TABLE dbo.pivot_afastamento_pessoa (
        id INT NOT NULL PRIMARY KEY
      );
      CREATE TABLE dbo.pivot_afastamento_pessoa_usuario (
        id INT NOT NULL PRIMARY KEY,
        afastamento_pessoa_id INT NOT NULL,
        usuario_id INT NOT NULL,
        usa_equipe_acervo_substituto BIT NULL,
        final_codigo_pa VARCHAR(50) NULL
      );

      INSERT INTO dbo.pivot_usuario (id, nome) VALUES (1, 'Ana'), (2, 'Bruno');
      INSERT INTO dbo.pivot_afastamento_pessoa (id) VALUES (10), (20);
      INSERT INTO dbo.pivot_afastamento_pessoa_usuario (id, afastamento_pessoa_id, usuario_id, usa_equipe_acervo_substituto, final_codigo_pa) VALUES
        (1, 10, 1, 1, 'PA-2023-001'),
        (2, 10, 2, 0, NULL);
    `);
  });

  it('should surface pivot columns on related entities', async () => {
    const pivotRef = entityRef(AfastamentoPessoaUsuario);
    const pivotRows = (await selectFromEntity(AfastamentoPessoaUsuario)
      .select({
        afastamento_pessoa_id: pivotRef.afastamento_pessoa_id,
        usuario_id: pivotRef.usuario_id,
        usa: pivotRef.usa_equipe_acervo_substituto,
        final: pivotRef.final_codigo_pa,
      })
      .where(
        or(
          isNotNull(pivotRef.usa_equipe_acervo_substituto),
          isNotNull(pivotRef.final_codigo_pa)
        )
      )
      .executePlain(session)) as PivotRow[];

    const pivotRow = pivotRows[0];
    expect(pivotRow).toBeTruthy();

    const afastamentoRef = entityRef(AfastamentoPessoa);
    const [afastamento] = await selectFromEntity(AfastamentoPessoa)
      .include('substitutos', {
        columns: ['id', 'nome'],
        pivot: { columns: ['usa_equipe_acervo_substituto', 'final_codigo_pa'], merge: true }
      })
      .where(eq(afastamentoRef.id, pivotRow.afastamento_pessoa_id))
      .execute(session);

    expect(afastamento).toBeTruthy();

    const substitutos = await afastamento.substitutos.load();
    const substituto = substitutos.find((s: any) => s.id === pivotRow.usuario_id) ?? substitutos[0];
    expect(substituto).toBeTruthy();

    const hasUsa = Object.prototype.hasOwnProperty.call(substituto as object, 'usa_equipe_acervo_substituto');
    const hasFinal = Object.prototype.hasOwnProperty.call(substituto as object, 'final_codigo_pa');
    expect(hasUsa).toBe(true);
    expect(hasFinal).toBe(true);
  });
});
