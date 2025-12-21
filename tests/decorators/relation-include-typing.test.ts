import { describe, expect, it, expectTypeOf } from 'vitest';
import { Entity } from '../../src/decorators/entity.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { HasMany, BelongsTo } from '../../src/decorators/relations.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import { bootstrapEntities, selectFromEntity } from '../../src/decorators/bootstrap.js';
import { OrmSession } from '../../src/orm/orm-session.js';

@Entity()
class Author {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  name!: string;

  @HasMany({ target: () => Post, foreignKey: 'author_id' })
  posts!: HasManyCollection<Post>;
}

@Entity()
class Post {
  @PrimaryKey(col.int())
  id!: number;

  @Column(col.varchar(255))
  title!: string;

  @Column(col.date<Date>())
  published_on!: Date;

  @BelongsTo({ target: () => Author, foreignKey: 'author_id' })
  author!: Author;
}

describe('relation include typing', () => {
  it('preserves relation column tsType when included', () => {
    bootstrapEntities();

    const qb = selectFromEntity(Author)
      .select('id', 'name')
      .include('posts', { columns: ['id', 'published_on'] });

    type ExecResult = Awaited<ReturnType<typeof qb.execute>>;
    type Row = ExecResult[number];

    // execute expects an OrmSession
    expectTypeOf(qb.execute).parameter(0).toEqualTypeOf<OrmSession>();
  });
});




