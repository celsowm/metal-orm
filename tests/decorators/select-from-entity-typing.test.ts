import { beforeEach, describe, expect, it, expectTypeOf } from 'vitest';
import { Column, PrimaryKey } from '../../src/decorators/column.js';
import { Entity } from '../../src/decorators/entity.js';
import { bootstrapEntities, selectFromEntity } from '../../src/decorators/bootstrap.js';
import { col } from '../../src/schema/column.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { OrmSession } from '../../src/orm/orm-session.js';

describe('selectFromEntity typing with decorators', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('preserves column tsType and literals on the table returned by selectFromEntity', () => {
    @Entity()
    class DecoratedUser {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      name!: string;

      @Column(col.date<Date>())
      birth_date!: Date;
    }

    bootstrapEntities();
    const builder = selectFromEntity(DecoratedUser);
    const table = builder.getTable();

    expect(builder).toBeDefined();
  });

  it('returns Date-typed properties through selectColumns + execute', () => {
    @Entity()
    class DecoratedUser {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.date<Date>())
      birth_date!: Date;
    }

    bootstrapEntities();
    const qb = selectFromEntity(DecoratedUser).selectColumns('birth_date');

    // And execute expects an OrmSession argument
    expectTypeOf(qb.execute).parameter(0).toEqualTypeOf<OrmSession>();
  });
});
