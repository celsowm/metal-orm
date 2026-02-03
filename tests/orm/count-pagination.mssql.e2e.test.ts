import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { eq, gt, count } from '../../src/core/ast/expression.js';
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

describeDb('Metal ORM count pagination (mssql)', () => {
  let connection: Connection;
  let session: OrmSession;
  let rootId: number;
  let pivotRowCount: number;

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
        dispose: async () => { },
      },
    });
    session = new OrmSession({ orm, executor });

    const pivotRef = entityRef(AfastamentoPessoaUsuario);
    const groups = (await selectFromEntity(AfastamentoPessoaUsuario)
      .select({
        afastamento_pessoa_id: pivotRef.afastamento_pessoa_id,
        total: count(pivotRef.id),
      })
      .groupBy(pivotRef.afastamento_pessoa_id)
      .having(gt(count(pivotRef.id), 1))
      .executePlain(session)) as { afastamento_pessoa_id: number; total: number | string | bigint }[];

    const afastamentoRef = entityRef(AfastamentoPessoa);
    for (const group of groups) {
      const candidateId = Number(group.afastamento_pessoa_id);
      const candidateCount = Number(group.total);
      if (!Number.isFinite(candidateId) || !Number.isFinite(candidateCount)) continue;
      if (candidateCount < 2) continue;

      const exists = await selectFromEntity(AfastamentoPessoa)
        .where(eq(afastamentoRef.id, candidateId))
        .count(session);

      if (exists > 0) {
        rootId = candidateId;
        pivotRowCount = candidateCount;
        break;
      }
    }

    if (!Number.isFinite(rootId) || !Number.isFinite(pivotRowCount)) {
      throw new Error('Need at least one afastamento_pessoa_id with 2+ pivot rows and a matching root row.');
    }
  });

  afterAll(() => {
    connection?.close();
  });

  it('count() returns distinct root count while countRows() returns joined row count', async () => {
    const afastamentoRef = entityRef(AfastamentoPessoa);
    const expectedDistinct = await selectFromEntity(AfastamentoPessoa)
      .where(eq(afastamentoRef.id, rootId))
      .count(session);

    const query = selectFromEntity(AfastamentoPessoa)
      .include('substitutos', { columns: ['id'] })
      .where(eq(afastamentoRef.id, rootId));

    const distinctCount = await query.count(session);
    const rowCount = await query.countRows(session);

    expect(distinctCount).toBe(expectedDistinct);
    expect(rowCount).toBe(pivotRowCount);
    expect(rowCount).toBeGreaterThan(distinctCount);
  }, 30_000);

  it('executePaged uses distinct count for totalItems', async () => {
    const afastamentoRef = entityRef(AfastamentoPessoa);
    const query = selectFromEntity(AfastamentoPessoa)
      .include('substitutos', { columns: ['id'] })
      .where(eq(afastamentoRef.id, rootId));

    const result = await query.executePaged(session, { page: 1, pageSize: 1 });

    expect(result.totalItems).toBe(1);
    expect(result.items).toHaveLength(1);
  }, 30_000);
});
