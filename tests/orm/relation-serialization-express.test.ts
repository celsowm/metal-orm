import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Connection, Request, TYPES } from 'tedious';
import { createTediousExecutor } from '../../src/core/execution/executors/mssql-executor.js';
import { SqlServerDialect } from '../../src/core/dialect/mssql/index.js';
import { Orm } from '../../src/orm/orm.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { Entity, PrimaryKey, Column, BelongsTo } from '../../src/decorators/index.js';
import { bootstrapEntities, selectFromEntity, entityRef } from '../../src/decorators/bootstrap.js';
import { col } from '../../src/schema/column-types.js';

// Entity definitions matching the real database
@Entity({ tableName: 'usuario' })
class Usuario {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  nome!: string;
}

@Entity({ tableName: 'especializada' })
class Especializada {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.int())
  responsavel_id!: number;

  @Column(col.varchar(255))
  nome!: string;

  @Column(col.varchar(50))
  sigla!: string;

  @BelongsTo({ target: () => Usuario, foreignKey: 'responsavel_id' })
  responsavel?: Usuario;
}

const hasMssqlEnv =
  !!process.env.PGE_DIGITAL_HOST &&
  !!process.env.PGE_DIGITAL_USER &&
  !!process.env.PGE_DIGITAL_PASSWORD;

const maybeMssql = hasMssqlEnv ? describe : describe.skip;

maybeMssql('Express + SQL Server relation serialization', () => {
  let connection: Connection;
  let session: OrmSession;
  let app: express.Express;

  beforeAll(async () => {
    bootstrapEntities();

    const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;

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
          database: 'pge_digital',
          encrypt: true,
          trustServerCertificate: true,
          port: 1433,
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

    // Setup Express app
    app = express();
    app.use(express.json());

    // GET /especializadas - returns entities with responsavel relation
    app.get('/especializadas', async (_req, res) => {
      try {
        const E = entityRef(Especializada);
        const results = await selectFromEntity(Especializada)
          .select('id', 'nome', 'sigla', 'responsavel_id')
          .includePick('responsavel', ['id', 'nome'])
          .orderBy(E.id, 'ASC')
          .limit(5)
          .execute(session);

        // This is exactly what adorn-api/Express does: res.json(entities)
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // GET /especializadas/:id - returns single entity
    app.get('/especializadas/:id', async (req, res) => {
      try {
        const E = entityRef(Especializada);
        const { eq } = await import('../../src/core/ast/expression.js');
        const results = await selectFromEntity(Especializada)
          .select('id', 'nome', 'sigla', 'responsavel_id')
          .includePick('responsavel', ['id', 'nome'])
          .where(eq(E.id, parseInt(req.params.id)))
          .execute(session);

        if (results.length === 0) {
          return res.status(404).json({ error: 'Not found' });
        }

        res.json(results[0]);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  });

  afterAll(() => {
    connection?.close();
  });

  it('should serialize responsavel with actual data via Express res.json()', async () => {
    const response = await request(app).get('/especializadas');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);

    const especializada = response.body[0];

    // Basic columns should exist
    expect(especializada).toHaveProperty('id');
    expect(especializada).toHaveProperty('nome');
    expect(especializada).toHaveProperty('sigla');

    // responsavel should have actual data (the "Thiago" fix)
    if (especializada.responsavel !== null) {
      expect(especializada.responsavel).not.toEqual({});
      expect(especializada.responsavel).toHaveProperty('id');
      expect(especializada.responsavel).toHaveProperty('nome');
      expect(typeof especializada.responsavel.id).toBe('number');
      expect(typeof especializada.responsavel.nome).toBe('string');
      expect(especializada.responsavel.nome.length).toBeGreaterThan(0);
    }

    // Should NOT expose wrapper internals
    expect(especializada.responsavel).not.toHaveProperty('loaded');
    expect(especializada.responsavel).not.toHaveProperty('current');
  });

  it('should serialize single entity with responsavel data', async () => {
    // First get list to find a valid ID
    const listResponse = await request(app).get('/especializadas');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.length).toBeGreaterThan(0);

    const id = listResponse.body[0].id;
    const response = await request(app).get(`/especializadas/${id}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', id);

    // responsavel should be properly serialized
    if (response.body.responsavel !== null) {
      expect(response.body.responsavel).not.toEqual({});
      expect(response.body.responsavel).toHaveProperty('id');
      expect(response.body.responsavel).toHaveProperty('nome');
    }

    // No wrapper internals
    expect(response.body.responsavel).not.toHaveProperty('loaded');
    expect(response.body.responsavel).not.toHaveProperty('current');
  });

  it('should include all defined relations by default (includeAllRelations=true)', async () => {
    const response = await request(app).get('/especializadas');

    expect(response.status).toBe(200);
    const especializada = response.body[0];

    // The responsavel relation should always be present (null or object)
    expect(especializada).toHaveProperty('responsavel');
  });
});
