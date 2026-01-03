import { beforeEach, describe, it, expectTypeOf } from 'vitest';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { Entity } from '../../src/decorators/entity.js';
import { bootstrapEntities, entityRefs, getTableDefFromEntity } from '../../src/decorators/bootstrap.js';
import { col } from '../../src/schema/column-types.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';

describe('entityRefs typing with decorators', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('returns a typed tuple of entity references', () => {
    @Entity()
    class User {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      username!: string;
    }

    @Entity()
    class Post {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.varchar(255))
      title!: string;
    }

    bootstrapEntities();
    const [U, P] = entityRefs(User, Post);

    const userTable = getTableDefFromEntity(User)!;
    const postTable = getTableDefFromEntity(Post)!;

    expectTypeOf(U.id).toMatchTypeOf<typeof userTable.columns.id>();
    expectTypeOf(U.username).toMatchTypeOf<typeof userTable.columns.username>();
    expectTypeOf(P.id).toMatchTypeOf<typeof postTable.columns.id>();
    expectTypeOf(P.title).toMatchTypeOf<typeof postTable.columns.title>();

    const refs = entityRefs(User, Post);
    const userRef = refs[0];
    const postRef = refs[1];

    expectTypeOf(userRef.username).toMatchTypeOf<typeof userTable.columns.username>();
    expectTypeOf(postRef.title).toMatchTypeOf<typeof postTable.columns.title>();

    // @ts-expect-error - "title" belongs to Post, not User
    userRef.title;
  });
});
