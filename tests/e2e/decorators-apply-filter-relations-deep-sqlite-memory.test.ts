import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { col } from '../../src/schema/column-types.js';
import { esel } from '../../src/query-builder/select-helpers.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { applyFilter } from '../../src/dto/apply-filter.js';
import type { WhereInput } from '../../src/dto/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  runSql
} from './sqlite-helpers.ts';

@Entity()
class Alpha {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(100))
  name!: string;

  @HasMany({ target: () => Bravo, foreignKey: 'alphaId' })
  bravos!: HasManyCollection<Bravo>;
}

@Entity()
class Bravo {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(100))
  name!: string;

  @Column(col.int())
  alphaId!: number;

  @BelongsTo({ target: () => Alpha, foreignKey: 'alphaId' })
  alpha?: Alpha;

  @HasMany({ target: () => Charlie, foreignKey: 'bravoId' })
  charlies!: HasManyCollection<Charlie>;
}

@Entity()
class Charlie {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(100))
  label!: string;

  @Column(col.int())
  bravoId!: number;

  @BelongsTo({ target: () => Bravo, foreignKey: 'bravoId' })
  bravo?: Bravo;

  @HasMany({ target: () => Delta, foreignKey: 'charlieId' })
  deltas!: HasManyCollection<Delta>;
}

@Entity()
class Delta {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(100))
  code!: string;

  @Column(col.int())
  charlieId!: number;

  @BelongsTo({ target: () => Charlie, foreignKey: 'charlieId' })
  charlie?: Charlie;
}

describe('decorators + applyFilter deep relations (sqlite)', () => {
  let db: sqlite3.Database;

  beforeEach(() => {
    db = new sqlite3.Database(':memory:');
  });

  afterEach(async () => {
    await closeDb(db);
  });

  it('filters alpha by A -> B -> C -> D relation chain', async () => {
    bootstrapEntities();
    const alphaTable = getTableDefFromEntity(Alpha)!;
    const bravoTable = getTableDefFromEntity(Bravo)!;
    const charlieTable = getTableDefFromEntity(Charlie)!;
    const deltaTable = getTableDefFromEntity(Delta)!;

    const session = createSqliteSessionFromDb(db);
    await executeSchemaSqlFor(
      session.executor,
      new SQLiteSchemaDialect(),
      alphaTable,
      bravoTable,
      charlieTable,
      deltaTable
    );

    await runSql(db, 'INSERT INTO alphas (id, name) VALUES (?, ?);', [1, 'Alpha One']);
    await runSql(db, 'INSERT INTO alphas (id, name) VALUES (?, ?);', [2, 'Alpha Two']);

    await runSql(db, 'INSERT INTO bravos (id, name, alphaId) VALUES (?, ?, ?);', [1, 'Shared', 1]);
    await runSql(db, 'INSERT INTO bravos (id, name, alphaId) VALUES (?, ?, ?);', [2, 'Shared', 2]);

    await runSql(db, 'INSERT INTO charlies (id, label, bravoId) VALUES (?, ?, ?);', [1, 'Chain', 1]);
    await runSql(db, 'INSERT INTO charlies (id, label, bravoId) VALUES (?, ?, ?);', [2, 'Chain', 2]);

    await runSql(db, 'INSERT INTO deltas (id, code, charlieId) VALUES (?, ?, ?);', [1, 'OK-123', 1]);
    await runSql(db, 'INSERT INTO deltas (id, code, charlieId) VALUES (?, ?, ?);', [2, 'NO-456', 2]);
    await runSql(db, 'INSERT INTO deltas (id, code, charlieId) VALUES (?, ?, ?);', [3, 'NO-789', 1]);

    const qb = selectFromEntity(Alpha)
      .select(esel(Alpha, 'id', 'name'))
      .include({
        bravos: {
          include: {
            charlies: {
              include: {
                deltas: true
              }
            }
          }
        }
      });

    const where: WhereInput<typeof Alpha> = {
      bravos: {
        some: {
          name: { equals: 'Shared' },
          charlies: {
            some: {
              label: { equals: 'Chain' },
              deltas: {
                some: { code: { startsWith: 'OK' } }
              }
            }
          }
        }
      }
    };

    const alphas = await applyFilter(qb, Alpha, where).execute(session);

    expect(alphas).toHaveLength(1);
    expect(alphas[0].name).toBe('Alpha One');

    const bravos = alphas[0].bravos.getItems();
    expect(bravos).toHaveLength(1);
    const charlies = bravos[0].charlies.getItems();
    expect(charlies).toHaveLength(1);
    const deltas = charlies[0].deltas.getItems();
    expect(deltas).toHaveLength(2);
    expect(deltas.some(delta => delta.code.startsWith('OK'))).toBe(true);
  });

  it('throws when relation filter is missing operators', () => {
    bootstrapEntities();
    const qb = selectFromEntity(Alpha).select(esel(Alpha, 'id', 'name'));
    const where = {
      bravos: {
        name: { equals: 'Shared' }
      }
    } as WhereInput<typeof Alpha>;

    expect(() => applyFilter(qb, Alpha, where)).toThrow(
      'Relation filter "bravos" must include at least one of "some", "none", "every", "isEmpty", or "isNotEmpty".'
    );
  });

  it('throws when nested relation filter is missing operators', () => {
    bootstrapEntities();
    const qb = selectFromEntity(Alpha).select(esel(Alpha, 'id', 'name'));
    const where = {
      bravos: {
        some: {
          charlies: {
            label: { equals: 'Chain' }
          }
        }
      }
    } as WhereInput<typeof Alpha>;

    expect(() => applyFilter(qb, Alpha, where)).toThrow(
      'Relation filter "charlies" must include at least one of "some", "none", "every", "isEmpty", or "isNotEmpty".'
    );
  });
});
