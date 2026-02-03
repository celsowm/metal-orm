import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { eq, isNotNull, or } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { BelongsToReference, ManyToManyCollection } from '../../src/schema/types.js';
import {
  BelongsTo,
  BelongsToMany,
  Column,
  Entity,
  PrimaryKey,
  bootstrapEntities,
  entityRef,
  selectFromEntity
} from '../../src/decorators/index.js';

/**
 * Minimal reproduction for Metal ORM pivot hydration on SQL Server.
 *
 * This test encodes a "flattened pivot columns" expectation to surface a
 * potential bug report. Current docs describe pivot columns under `_pivot`
 * (or a custom alias), so this will fail unless that behavior changes.
 */

@Entity({ tableName: 'usuario' })
class Usuario {
  @PrimaryKey(col.notNull(col.int()))
  id!: number;

  @Column(col.varchar(255))
  nome?: string;
}

@Entity({ tableName: 'afastamento_pessoa' })
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

@Entity({ tableName: 'afastamento_pessoa_usuario' })
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

const REQUIRED_ENV = ['PGE_DIGITAL_HOST', 'PGE_DIGITAL_USER', 'PGE_DIGITAL_PASSWORD'] as const;

const hasDbEnv = REQUIRED_ENV.every((name) => !!process.env[name]);
const describeDb = hasDbEnv ? describe : describe.skip;

const parseBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

describeDb('Metal ORM pivot hydration (mssql)', () => {
  let connection: Connection;
  let session: OrmSession;

  type PivotRow = {
    afastamento_pessoa_id: number;
    usuario_id: number;
    usa?: boolean | null;
    final?: string | null;
  };

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

    if (!pivotRow) {
      throw new Error('No pivot rows with non-null pivot columns found.');
    }

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

    // This is the claimed bug: fields are only in _pivot, not on the entity itself.
    const hasUsa = Object.prototype.hasOwnProperty.call(substituto as object, 'usa_equipe_acervo_substituto');
    const hasFinal = Object.prototype.hasOwnProperty.call(substituto as object, 'final_codigo_pa');
    expect(hasUsa).toBe(true);
    expect(hasFinal).toBe(true);
  }, 30_000);
});
