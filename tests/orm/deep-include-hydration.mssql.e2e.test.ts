import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { BelongsToReference, HasManyCollection } from '../../src/schema/types.js';
import {
  BelongsTo,
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  bootstrapEntities,
  entityRef,
  selectFromEntity
} from '../../src/decorators/index.js';

// Schema introspectado do SQL Server PGE_DIGITAL

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

const REQUIRED_ENV = ['PGE_DIGITAL_HOST', 'PGE_DIGITAL_USER', 'PGE_DIGITAL_PASSWORD'] as const;

const hasDbEnv = REQUIRED_ENV.every((name) => !!process.env[name]);
const describeDb = hasDbEnv ? describe : describe.skip;

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

describeDb('Metal ORM deep include hydration (mssql)', () => {
  let connection: Connection;
  let session: OrmSession;

  beforeAll(async () => {
    bootstrapEntities();

    const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;
    const database = process.env.PGE_DIGITAL_DATABASE ?? 'PGE_DIGITAL';
    const encrypt = parseBool(process.env.PGE_DIGITAL_ENCRYPT, true);
    const trustServerCertificate = parseBool(process.env.PGE_DIGITAL_TRUST_CERT, true);
    const port = Number(process.env.PGE_DIGITAL_PORT ?? '1433');

    connection = await new Promise<Connection>((resolve, reject) => {
      const conn = new Connection({
        server: PGE_DIGITAL_HOST!,
        authentication: {
          type: 'default',
          options: {
            userName: PGE_DIGITAL_USER!,
            password: PGE_DIGITAL_PASSWORD!,
          },
        },
        options: {
          database,
          encrypt,
          trustServerCertificate,
          port: Number.isFinite(port) ? port : 1433,
        },
      });

      conn.on('connect', (err) => (err ? reject(err) : resolve(conn)));
      conn.connect();
    });

    const executor = createTediousExecutor(connection, { Request, TYPES });
    const orm = new Orm({
      dialect: new SqlServerDialect(),
      executorFactory: {
        createExecutor: () => executor,
        createTransactionalExecutor: () => executor,
        dispose: async () => {},
      },
    });
    session = new OrmSession({ orm, executor });
  });

  afterAll(() => {
    connection?.close();
  });

  it('should hydrate all nested levels when filtering by usuario_id = 68', async () => {
    const cargaRef = entityRef(Carga);

    // Query com includes profundos conforme schema real
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
      .where(eq(cargaRef.usuario_id, 68))
      .execute(session);

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);

    if (result.length === 0) {
      console.log('No cargas found for usuario_id = 68');
      return;
    }

    console.log(`Found ${result.length} cargas for usuario_id = 68`);

    for (const carga of result) {
      expect(carga.id).toBeDefined();
      expect(carga.usuario_id).toBe(68);

      // Verifica registroTramitacao
      const registroTramitacao = await carga.registroTramitacao.load();
      expect(registroTramitacao).toBeDefined();
      expect(registroTramitacao.id).toBeDefined();
      console.log(`  Carga ${carga.id}: RegistroTramitacao ${registroTramitacao.id} loaded`);

      // Verifica tramitacao (nível 2)
      const tramitacao = await registroTramitacao.tramitacao.load();
      if (tramitacao) {
        expect(tramitacao.id).toBeDefined();
        expect(tramitacao.nome).toBeDefined();
        console.log(`    -> Tramitacao: ${tramitacao.nome} (${tramitacao.codigo})`);
      }

      // Verifica remetente (nível 2)
      const remetente = await registroTramitacao.remetente.load();
      if (remetente) {
        expect(remetente.id).toBeDefined();
        expect(remetente.nome).toBeDefined();
        console.log(`    -> Remetente: ${remetente.nome}`);
      }

      // Verifica processoAdministrativo
      const processoAdministrativo = await carga.processoAdministrativo?.load();
      if (processoAdministrativo) {
        expect(processoAdministrativo.id).toBeDefined();
        console.log(`  Carga ${carga.id}: ProcessoAdministrativo ${processoAdministrativo.id} loaded`);

        // Verifica classificacao (nível 2)
        const classificacao = await processoAdministrativo.classificacao?.load();
        if (classificacao) {
          expect(classificacao.id).toBeDefined();
          expect(classificacao.nome).toBeDefined();
          console.log(`    -> Classificacao: ${classificacao.nome}`);
        }

        // Verifica especializada (nível 2)
        const especializada = await processoAdministrativo.especializada.load();
        if (especializada) {
          expect(especializada.id).toBeDefined();
          expect(especializada.nome).toBeDefined();
          console.log(`    -> Especializada: ${especializada.nome}`);
        }

        // Verifica acervo (nível 2)
        const acervo = await processoAdministrativo.acervo?.load();
        if (acervo) {
          expect(acervo.id).toBeDefined();
          expect(acervo.nome).toBeDefined();
          console.log(`    -> Acervo: ${acervo.nome}`);
        }

        // Verifica processoJudicial (nível 2)
        const processoJudicial = await processoAdministrativo.processoJudicial?.load();
        if (processoJudicial) {
          expect(processoJudicial.id).toBeDefined();
          expect(processoJudicial.numero).toBeDefined();
          console.log(`    -> ProcessoJudicial: ${processoJudicial.numero}`);

          // Verifica partes (nível 3)
          const partes = await processoJudicial.partes.load();
          console.log(`       -> Partes count: ${partes.length}`);
          
          if (partes.length > 0) {
            for (const parte of partes) {
              expect(parte.id).toBeDefined();
              
              // Verifica pessoa (nível 4 - último nível)
              const pessoa = await parte.pessoa.load();
              if (pessoa) {
                expect(pessoa.id).toBeDefined();
                expect(pessoa.nome).toBeDefined();
                console.log(`          -> Parte ${parte.id}: Pessoa ${pessoa.nome}`);
              }
            }
          }
        }
      }
    }

    console.log('\n✅ All nested levels hydrated successfully!');
  }, 120_000);

  it('should generate correct SQL for deep nested includes', async () => {
    const cargaRef = entityRef(Carga);

    const query = selectFromEntity(Carga)
      .include('registroTramitacao', {
        columns: ['id', 'data_hora_tramitacao', 'substituicao'],
        include: {
          tramitacao: { columns: ['id', 'nome', 'codigo'] },
          remetente: { columns: ['id', 'nome'] }
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
      .where(eq(cargaRef.usuario_id, 68));

    const sql = query.toSql(new SqlServerDialect());
    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM');
    expect(sql).toContain('[carga]');

    console.log('Generated SQL:', sql.substring(0, 500) + '...');
  }, 30_000);

  it('should hydrate paginated results with same filter and include pessoa nome', async () => {
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
      .where(eq(cargaRef.usuario_id, 68))
      .executePaged(session, { page: 1, pageSize: 25 });

    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(typeof result.totalItems).toBe('number');

    console.log(`Paginated result: ${result.items.length} items on page ${result.page} of ${Math.ceil(result.totalItems / result.pageSize)} (total: ${result.totalItems})`);

    if (result.items.length === 0) {
      console.log('No paginated cargas found for usuario_id = 68');
      return;
    }

    let pessoaNomeFound = false;

    for (const carga of result.items) {
      expect(carga.id).toBeDefined();
      expect(carga.usuario_id).toBe(68);

      const registroTramitacao = await carga.registroTramitacao.load();
      expect(registroTramitacao).toBeDefined();

      const processoAdministrativo = await carga.processoAdministrativo?.load();
      if (processoAdministrativo) {
        const processoJudicial = await processoAdministrativo.processoJudicial?.load();
        if (processoJudicial) {
          const partes = await processoJudicial.partes.load();

          for (const parte of partes) {
            const pessoa = await parte.pessoa.load();
            if (pessoa) {
              expect(pessoa.id).toBeDefined();
              expect(pessoa.nome).toBeDefined();
              expect(typeof pessoa.nome).toBe('string');
              expect(pessoa.nome.length).toBeGreaterThan(0);
              pessoaNomeFound = true;
              console.log(`  Carga ${carga.id}: Parte ${parte.id} -> Pessoa: ${pessoa.nome}`);
            }
          }
        }
      }
    }

    if (pessoaNomeFound) {
      console.log('\n✅ Paginated results successfully include pessoa nome!');
    } else {
      console.log('\n⚠️ No pessoa nome found in paginated results (may be expected if no related data)');
    }
  }, 120_000);
});
