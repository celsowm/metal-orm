import { describe, expect, it } from 'vitest';
import express from 'express';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import {
  BelongsTo,
  Column,
  Entity,
  HasOne,
  PrimaryKey,
  bootstrapEntities,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';

@Entity({ tableName: 'usuarios' })
class Usuario {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  nome!: string;

  @HasOne({ target: () => Perfil, foreignKey: 'usuarioId' })
  perfil!: Perfil;
}

@Entity({ tableName: 'perfis' })
class Perfil {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  bio!: string;

  @Column(col.notNull(col.int()))
  usuarioId!: number;

  @BelongsTo({ target: () => Usuario, foreignKey: 'usuarioId' })
  usuario!: Usuario;
}

const buildOpenApiSpec = () => {
  bootstrapEntities();
  const usuarioTable = getTableDefFromEntity(Usuario);
  if (!usuarioTable) {
    throw new Error('Expected Usuario table definition to be available.');
  }

  const { output, parameters } = selectFromEntity(Usuario)
    .select('id', 'nome')
    .includePick('perfil', ['bio'])
    .where(eq(usuarioTable.columns.nome, 'Gabriel'))
    .getSchema({ mode: 'selected' });

  return {
    openapi: '3.1.0',
    info: {
      title: 'Metal ORM Express Decorators Test',
      version: '0.1.0'
    },
    paths: {
      '/usuarios': {
        get: {
          parameters,
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: output
                  }
                }
              }
            }
          }
        }
      }
    }
  };
};

describe('OpenAPI schema with decorator entities and Express', () => {
  it('supports deepObject filters over HTTP', async () => {
    const app = express();
    app.set('query parser', 'extended');

    app.get('/openapi.json', (_req, res) => {
      res.json(buildOpenApiSpec());
    });

    app.get('/usuarios', (req, res) => {
      res.json(req.query);
    });

    const server = await new Promise<import('node:http').Server>((resolve, reject) => {
      const listener = app.listen(0, () => resolve(listener));
      listener.on('error', reject);
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Expected Express server to bind to a TCP port.');
      }

      const specResponse = await fetch(`http://127.0.0.1:${address.port}/openapi.json`);
      expect(specResponse.ok).toBe(true);

      type OpenApiSchema = {
        type?: string;
        properties?: Record<string, OpenApiSchema>;
        items?: OpenApiSchema;
      };
      type OpenApiParameter = {
        name: string;
        in: string;
        style?: string;
        explode?: boolean;
        schema?: OpenApiSchema;
      };
      type OpenApiSpec = {
        openapi: string;
        paths: {
          '/usuarios': {
            get: {
              parameters?: OpenApiParameter[];
            };
          };
        };
      };

      const spec = (await specResponse.json()) as OpenApiSpec;
      expect(spec.openapi).toBe('3.1.0');

      const filterParam = spec.paths['/usuarios'].get.parameters?.find(param => param.name === 'filter');
      expect(filterParam?.in).toBe('query');
      expect(filterParam?.style).toBe('deepObject');
      expect(filterParam?.explode).toBe(true);
      expect(filterParam?.schema?.properties?.nome).toBeDefined();

      const queryResponse = await fetch(
        `http://127.0.0.1:${address.port}/usuarios?filter[nome]=Gabriel&filter[perfil][bio]=ai`
      );
      expect(queryResponse.ok).toBe(true);

      const queryPayload = await queryResponse.json();
      expect(queryPayload).toEqual({
        filter: {
          nome: 'Gabriel',
          perfil: {
            bio: 'ai'
          }
        }
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    }
  });
});
