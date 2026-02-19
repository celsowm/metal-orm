import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import {
  BelongsTo,
  bootstrapEntities,
  Column,
  Entity,
  getTableDefFromEntity,
  PrimaryKey,
  selectFromEntity
} from '../../src/decorators/index.js';
import { Tree, TreeChildren, TreeParent } from '../../src/tree/tree-decorator.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { closeDb, createSqliteSessionFromDb, runSql } from './sqlite-helpers.ts';

@Entity({ tableName: 'modelo' })
class E2eModelo {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  nome!: string;
}

@Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght' })
@Entity({ tableName: 'capitulo' })
class E2eCapitulo {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.notNull(col.int()))
  modelo_id!: number;

  @Column(col.notNull(col.varchar(255)))
  titulo!: string;

  @Column(col.notNull(col.text()))
  html!: string;

  @Column(col.int())
  parent_id?: number | null;

  @Column(col.int())
  lft?: number;

  @Column(col.int())
  rght?: number;

  @BelongsTo({ target: () => E2eModelo, foreignKey: 'modelo_id' })
  modelo?: E2eModelo;

  @TreeParent()
  parent?: E2eCapitulo;

  @TreeChildren()
  capitulos?: E2eCapitulo[];
}

describe('tree include with sqlite in-memory', () => {
  it('loads parent and children includes on tree entities', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      bootstrapEntities();
      const modeloTable = getTableDefFromEntity(E2eModelo)!;
      const capituloTable = getTableDefFromEntity(E2eCapitulo)!;
      const session = createSqliteSessionFromDb(db);

      await executeSchemaSqlFor(
        session.executor,
        new SQLiteSchemaDialect(),
        modeloTable,
        capituloTable
      );

      await runSql(db, 'INSERT INTO modelo (id, nome) VALUES (?, ?);', [1, 'Modelo A']);

      await runSql(
        db,
        'INSERT INTO capitulo (id, modelo_id, titulo, html, parent_id, lft, rght) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [1, 1, 'Capitulo Raiz', '<h1>root</h1>', null, 1, 6]
      );
      await runSql(
        db,
        'INSERT INTO capitulo (id, modelo_id, titulo, html, parent_id, lft, rght) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [2, 1, 'Capitulo Filho', '<p>child</p>', 1, 2, 5]
      );
      await runSql(
        db,
        'INSERT INTO capitulo (id, modelo_id, titulo, html, parent_id, lft, rght) VALUES (?, ?, ?, ?, ?, ?, ?);',
        [3, 1, 'Capitulo Neto', '<p>grandchild</p>', 2, 3, 4]
      );

      const [child] = await selectFromEntity(E2eCapitulo)
        .include('modelo', { columns: ['id', 'nome'] })
        .include('parent', { columns: ['id', 'titulo'] })
        .include('capitulos', { columns: ['id', 'titulo', 'parent_id'] })
        .where(eq(capituloTable.columns.id, 2))
        .execute(session);

      const toEntity = <T>(value: unknown): T | null | undefined =>
        value && typeof (value as { get?: () => unknown }).get === 'function'
          ? ((value as { get: () => unknown }).get() as T | null | undefined)
          : (value as T | null | undefined);

      const toItems = <T>(value: unknown): T[] =>
        Array.isArray(value)
          ? (value as T[])
          : value && typeof (value as { getItems?: () => unknown }).getItems === 'function'
            ? (((value as { getItems: () => unknown }).getItems() as T[]) ?? [])
            : [];

      expect(child).toBeDefined();
      const childModelo = toEntity<E2eModelo>(child.modelo);
      const childParent = toEntity<E2eCapitulo>(child.parent);
      expect(childModelo).toBeDefined();
      expect(childModelo?.nome).toBe('Modelo A');
      expect(childParent).toBeDefined();
      expect(childParent?.titulo).toBe('Capitulo Raiz');

      const childChildren = toItems<E2eCapitulo>(child.capitulos);
      expect(childChildren).toHaveLength(1);
      expect(childChildren[0].titulo).toBe('Capitulo Neto');

      const [root] = await selectFromEntity(E2eCapitulo)
        .include('parent', { columns: ['id', 'titulo'] })
        .where(eq(capituloTable.columns.id, 1))
        .execute(session);

      expect(root).toBeDefined();
      const rootParent = toEntity<E2eCapitulo>(root.parent);
      expect([null, undefined]).toContain(rootParent);
    } finally {
      await closeDb(db);
    }
  });
});
