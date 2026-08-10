import { beforeEach, expect, it } from 'vitest';

import { getSetup } from './mssql-connection.js';
import { describeMssql } from '../mssql-helpers.js';
import { eq } from '../../../src/core/ast/expression.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { col } from '../../../src/schema/column-types.js';
import type { BelongsToReference, HasManyCollection } from '../../../src/schema/types.js';
import {
  BelongsTo,
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  bootstrapEntities,
  entityRef,
  selectFromEntity
} from '../../../src/decorators/index.js';

@Entity({ tableName: 'usuario' })
class Usuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  nome?: string;
}

@Entity({ tableName: 'tramitacao' })
class Tramitacao {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(127))
  nome?: string;

  @Column(col.varchar(3))
  codigo?: string;
}

@Entity({ tableName: 'registro_tramitacao' })
class RegistroTramitacao {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.datetime())
  data_hora_tramitacao?: Date;

  @Column(col.boolean())
  substituicao?: boolean;

  @Column(col.int())
  tramitacao_id!: number;

  @Column(col.int())
  remetente_id!: number;

  @Column(col.int())
  processo_administrativo_id!: number;

  @BelongsTo({ target: () => Tramitacao, foreignKey: 'tramitacao_id' })
  tramitacao!: BelongsToReference<Tramitacao>;

  @BelongsTo({ target: () => Usuario, foreignKey: 'remetente_id' })
  remetente!: BelongsToReference<Usuario>;

  @BelongsTo({ target: () => ProcessoAdministrativo, foreignKey: 'processo_administrativo_id' })
  processoAdministrativo!: BelongsToReference<ProcessoAdministrativo>;
}

@Entity({ tableName: 'classificacao' })
class Classificacao {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(63))
  nome?: string;
}

@Entity({ tableName: 'especializada' })
class Especializada {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  nome?: string;
}

@Entity({ tableName: 'acervo' })
class Acervo {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(125))
  nome?: string;
}

@Entity({ tableName: 'processo_judicial' })
class ProcessoJudicial {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(20))
  numero?: string;

  @HasMany({ target: () => Parte, foreignKey: 'processo_judicial_id' })
  partes!: HasManyCollection<Parte>;
}

@Entity({ tableName: 'parte' })
class Parte {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(2))
  tipo_polo_id?: string;

  @Column(col.int())
  processo_judicial_id!: number;

  @Column(col.int())
  pessoa_id!: number;

  @BelongsTo({ target: () => ProcessoJudicial, foreignKey: 'processo_judicial_id' })
  processoJudicial!: BelongsToReference<ProcessoJudicial>;

  @BelongsTo({ target: () => Pessoa, foreignKey: 'pessoa_id' })
  pessoa!: BelongsToReference<Pessoa>;
}

@Entity({ tableName: 'pessoa' })
class Pessoa {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(500))
  nome?: string;
}

@Entity({ tableName: 'processo_administrativo' })
class ProcessoAdministrativo {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(25))
  codigo_pa?: string;

  @Column(col.int())
  especializada_id!: number;

  @Column(col.int())
  acervo_id?: number;

  @Column(col.int())
  classificacao_id?: number;

  @Column(col.int())
  processo_judicial_id?: number;

  @Column(col.decimal(18, 2))
  valor_causa?: number;

  @BelongsTo({ target: () => Classificacao, foreignKey: 'classificacao_id' })
  classificacao?: BelongsToReference<Classificacao>;

  @BelongsTo({ target: () => Especializada, foreignKey: 'especializada_id' })
  especializada!: BelongsToReference<Especializada>;

  @BelongsTo({ target: () => Acervo, foreignKey: 'acervo_id' })
  acervo?: BelongsToReference<Acervo>;

  @BelongsTo({ target: () => ProcessoJudicial, foreignKey: 'processo_judicial_id' })
  processoJudicial?: BelongsToReference<ProcessoJudicial>;
}

@Entity({ tableName: 'carga' })
class Carga {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.int())
  usuario_id!: number;

  @Column(col.int())
  registro_tramitacao_id!: number;

  @Column(col.int())
  processo_administrativo_id?: number;

  @BelongsTo({ target: () => RegistroTramitacao, foreignKey: 'registro_tramitacao_id' })
  registroTramitacao!: BelongsToReference<RegistroTramitacao>;

  @BelongsTo({ target: () => ProcessoAdministrativo, foreignKey: 'processo_administrativo_id' })
  processoAdministrativo?: BelongsToReference<ProcessoAdministrativo>;
}

const USER_ID = 68;
const SEED_SQL = `
  IF OBJECT_ID('dbo.carga', 'U') IS NOT NULL DROP TABLE dbo.carga;
  IF OBJECT_ID('dbo.registro_tramitacao', 'U') IS NOT NULL DROP TABLE dbo.registro_tramitacao;
  IF OBJECT_ID('dbo.processo_administrativo', 'U') IS NOT NULL DROP TABLE dbo.processo_administrativo;
  IF OBJECT_ID('dbo.parte', 'U') IS NOT NULL DROP TABLE dbo.parte;
  IF OBJECT_ID('dbo.processo_judicial', 'U') IS NOT NULL DROP TABLE dbo.processo_judicial;
  IF OBJECT_ID('dbo.pessoa', 'U') IS NOT NULL DROP TABLE dbo.pessoa;
  IF OBJECT_ID('dbo.tramitacao', 'U') IS NOT NULL DROP TABLE dbo.tramitacao;
  IF OBJECT_ID('dbo.usuario', 'U') IS NOT NULL DROP TABLE dbo.usuario;
  IF OBJECT_ID('dbo.classificacao', 'U') IS NOT NULL DROP TABLE dbo.classificacao;
  IF OBJECT_ID('dbo.especializada', 'U') IS NOT NULL DROP TABLE dbo.especializada;
  IF OBJECT_ID('dbo.acervo', 'U') IS NOT NULL DROP TABLE dbo.acervo;

  CREATE TABLE dbo.usuario (id INT NOT NULL PRIMARY KEY, nome VARCHAR(255));
  CREATE TABLE dbo.tramitacao (id INT NOT NULL PRIMARY KEY, nome VARCHAR(127), codigo VARCHAR(3));
  CREATE TABLE dbo.classificacao (id INT NOT NULL PRIMARY KEY, nome VARCHAR(63));
  CREATE TABLE dbo.especializada (id INT NOT NULL PRIMARY KEY, nome VARCHAR(255));
  CREATE TABLE dbo.acervo (id INT NOT NULL PRIMARY KEY, nome VARCHAR(125));
  CREATE TABLE dbo.pessoa (id INT NOT NULL PRIMARY KEY, nome VARCHAR(500));
  CREATE TABLE dbo.processo_judicial (id INT NOT NULL PRIMARY KEY, numero VARCHAR(20));
  CREATE TABLE dbo.processo_administrativo (
    id INT NOT NULL PRIMARY KEY,
    codigo_pa VARCHAR(25),
    especializada_id INT,
    acervo_id INT,
    classificacao_id INT,
    processo_judicial_id INT,
    valor_causa DECIMAL(18,2)
  );
  CREATE TABLE dbo.parte (
    id INT NOT NULL PRIMARY KEY,
    tipo_polo_id VARCHAR(2),
    processo_judicial_id INT,
    pessoa_id INT
  );
  CREATE TABLE dbo.registro_tramitacao (
    id INT NOT NULL PRIMARY KEY,
    data_hora_tramitacao DATETIME,
    substituicao BIT,
    tramitacao_id INT,
    remetente_id INT,
    processo_administrativo_id INT
  );
  CREATE TABLE dbo.carga (
    id INT NOT NULL PRIMARY KEY,
    usuario_id INT,
    registro_tramitacao_id INT,
    processo_administrativo_id INT
  );

  INSERT INTO dbo.usuario (id, nome) VALUES (68, 'Usuário 68');
  INSERT INTO dbo.usuario (id, nome) VALUES (2, 'Remetente');
  INSERT INTO dbo.tramitacao (id, nome, codigo) VALUES (1, 'Tramitacao A', 'A01');
  INSERT INTO dbo.classificacao (id, nome) VALUES (1, 'Classificacao X');
  INSERT INTO dbo.especializada (id, nome) VALUES (1, 'Especializada Y');
  INSERT INTO dbo.acervo (id, nome) VALUES (1, 'Acervo Z');
  INSERT INTO dbo.pessoa (id, nome) VALUES (1, 'Pessoa Um');
  INSERT INTO dbo.pessoa (id, nome) VALUES (2, 'Pessoa Dois');
  INSERT INTO dbo.processo_judicial (id, numero) VALUES (1, '001');
  INSERT INTO dbo.processo_administrativo (id, codigo_pa, especializada_id, acervo_id, classificacao_id, processo_judicial_id, valor_causa)
    VALUES (1, 'PA-1', 1, 1, 1, 1, 100.50);
  INSERT INTO dbo.parte (id, tipo_polo_id, processo_judicial_id, pessoa_id) VALUES (1, '1', 1, 1);
  INSERT INTO dbo.parte (id, tipo_polo_id, processo_judicial_id, pessoa_id) VALUES (2, '2', 1, 2);
  INSERT INTO dbo.registro_tramitacao (id, data_hora_tramitacao, substituicao, tramitacao_id, remetente_id, processo_administrativo_id)
    VALUES (1, '2024-01-01T10:00:00', 0, 1, 2, 1);
  INSERT INTO dbo.carga (id, usuario_id, registro_tramitacao_id, processo_administrativo_id)
    VALUES (1, 68, 1, 1), (2, 68, 1, 1);
`;

describeMssql('Metal ORM deep include hydration (mssql)', () => {
  let executor: Awaited<ReturnType<typeof getSetup>>['executor'];
  let session: Awaited<ReturnType<typeof getSetup>>['session'];

  beforeEach(async () => {
    bootstrapEntities();
    ({ executor, session } = await getSetup());
    await executor.executeSql(SEED_SQL);
  });

  it('should hydrate all nested levels', async () => {
    const cargaRef = entityRef(Carga);

    const result = await selectFromEntity(Carga)
      .include('registroTramitacao', {
        columns: ['id', 'data_hora_tramitacao', 'substituicao'],
        include: {
          tramitacao: { columns: ['id', 'nome', 'codigo'] },
          remetente: { columns: ['id', 'nome'] }
        }
      })
      .include('processoAdministrativo', {
        columns: ['id', 'codigo_pa', 'especializada_id', 'acervo_id', 'classificacao_id', 'processo_judicial_id', 'valor_causa'],
        include: {
          classificacao: { columns: ['id', 'nome'] },
          especializada: { columns: ['id', 'nome'] },
          acervo: { columns: ['id', 'nome'] },
          processoJudicial: {
            columns: ['id', 'numero'],
            include: {
              partes: {
                columns: ['id', 'tipo_polo_id'],
                include: {
                  pessoa: { columns: ['id', 'nome'] }
                }
              }
            }
          }
        }
      })
      .where(eq(cargaRef.usuario_id, USER_ID))
      .execute(session);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    for (const carga of result) {
      expect(carga.usuario_id).toBe(USER_ID);

      const registroTramitacao = await carga.registroTramitacao.load();
      expect(registroTramitacao.id).toBeDefined();
      expect(registroTramitacao.tramitacao?.id).toBeDefined();
      expect(registroTramitacao.remetente?.id).toBeDefined();

      const processoAdministrativo = await carga.processoAdministrativo?.load();
      expect(processoAdministrativo).toBeDefined();
      expect(processoAdministrativo!.classificacao?.id).toBeDefined();
      expect(processoAdministrativo!.especializada?.id).toBeDefined();
      expect(processoAdministrativo!.acervo?.id).toBeDefined();

      const processoJudicial = await processoAdministrativo!.processoJudicial?.load();
      expect(processoJudicial).toBeDefined();

      const partes = await processoJudicial!.partes.load();
      expect(partes.length).toBeGreaterThan(0);
      for (const parte of partes) {
        const pessoa = await parte.pessoa.load();
        expect(pessoa?.id).toBeDefined();
        expect(pessoa?.nome).toBeDefined();
      }
    }
  });

  it('should generate correct SQL for deep nested includes', async () => {
    const cargaRef = entityRef(Carga);

    const query = selectFromEntity(Carga)
      .include('registroTramitacao', {
        columns: ['id', 'data_hora_tramitacao', 'substituicao'],
        include: {
          tramitacao: { columns: ['id', 'nome', 'codigo'] }
        }
      })
      .include('processoAdministrativo', {
        columns: ['id', 'codigo_pa'],
        include: {
          classificacao: { columns: ['id', 'nome'] },
          processoJudicial: {
            columns: ['id', 'numero'],
            include: {
              partes: {
                columns: ['id', 'tipo_polo_id'],
                include: {
                  pessoa: { columns: ['id', 'nome'] }
                }
              }
            }
          }
        }
      })
      .where(eq(cargaRef.usuario_id, USER_ID));

    const sql = query.toSql(new SqlServerDialect());
    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM');
    expect(sql.toLowerCase()).toContain('carga');
  });

  it('should hydrate paginated results with deep includes', async () => {
    const cargaRef = entityRef(Carga);

    const result = await selectFromEntity(Carga)
      .include('registroTramitacao', { columns: ['id'] })
      .include('processoAdministrativo', {
        columns: ['id', 'codigo_pa'],
        include: {
          processoJudicial: {
            columns: ['id', 'numero'],
            include: {
              partes: {
                columns: ['id', 'tipo_polo_id'],
                include: {
                  pessoa: { columns: ['id', 'nome'] }
                }
              }
            }
          }
        }
      })
      .where(eq(cargaRef.usuario_id, USER_ID))
      .executePaged(session, { page: 1, pageSize: 25 });

    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(typeof result.totalItems).toBe('number');

    if (result.items.length > 0) {
      const processoAdministrativo = await result.items[0].processoAdministrativo?.load();
      if (processoAdministrativo) {
        const processoJudicial = await processoAdministrativo.processoJudicial?.load();
        if (processoJudicial) {
          const partes = await processoJudicial.partes.load();
          for (const parte of partes) {
            const pessoa = await parte.pessoa.load();
            expect(pessoa?.nome).toBeDefined();
          }
        }
      }
    }
  });
});
