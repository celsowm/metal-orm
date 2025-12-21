import { describe, expect, it } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  HasOne,
  BelongsTo,
  BelongsToMany,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';

const ManualPosts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255)
});

const ManualComments = defineTable('comments', {
  id: col.primaryKey(col.int()),
  post_id: col.int(),
  body: col.varchar(512)
});

ManualPosts.relations = {
  comments: hasMany(ManualComments, 'post_id')
};

ManualComments.relations = {
  post: belongsTo(ManualPosts, 'post_id')
};

@Entity()
class PostEntity {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.varchar(255))
  title = '';

  @HasMany({ target: () => CommentEntity, foreignKey: 'post_id' })
  comments?: unknown;
}

@Entity()
class CommentEntity {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.int())
  post_id = 0;

  @Column(col.varchar(512))
  body = '';

  @BelongsTo({ target: PostEntity, foreignKey: 'post_id' })
  post?: PostEntity;
}

@Entity()
class DefaultBelongsToUser {
  @PrimaryKey(col.int())
  id = 0;
}

@Entity()
class DefaultBelongsToPost {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.int())
  user_id = 0;

  @BelongsTo({ target: () => DefaultBelongsToUser })
  user?: DefaultBelongsToUser;
}

@Entity()
class DefaultHasOneAccount {
  @PrimaryKey(col.int())
  id = 0;

  @HasOne({ target: () => DefaultHasOneProfile })
  profile?: DefaultHasOneProfile;
}

@Entity()
class DefaultHasOneProfile {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.int())
  default_has_one_account_id = 0;
}

@Entity()
class DefaultHasManyParent {
  @PrimaryKey(col.int())
  id = 0;

  @HasMany({ target: () => DefaultHasManyChild })
  children?: unknown;
}

@Entity()
class DefaultHasManyChild {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.int())
  default_has_many_parent_id = 0;
}

@Entity()
class Post {
  @PrimaryKey(col.int())
  id = 0;

  @BelongsToMany({ target: () => Tag, pivotTable: () => PostTag })
  tags?: unknown;
}

@Entity()
class Tag {
  @PrimaryKey(col.int())
  id = 0;
}

@Entity()
class PostTag {
  @PrimaryKey(col.int())
  id = 0;

  @Column(col.int())
  post_id = 0;

  @Column(col.int())
  tag_id = 0;
}

describe('decorator metadata bootstrap', () => {
  it('produces table definitions that match manual tables', () => {
    const tables = bootstrapEntities();
    const postsTable = tables.find(table => table.name === 'posts');
    const commentsTable = tables.find(table => table.name === 'comments');
    expect(postsTable).toBeDefined();
    expect(commentsTable).toBeDefined();
    expect(postsTable?.columns).toEqual(ManualPosts.columns);
    expect(commentsTable?.columns).toEqual(ManualComments.columns);
    expect(postsTable?.relations.comments.type).toBe('HAS_MANY');
    expect(commentsTable?.relations.post.type).toBe('BELONGS_TO');
  });

  it('reuses the bootstrapped metadata via helpers', () => {
    bootstrapEntities();
    const postTable = getTableDefFromEntity(PostEntity);
    expect(postTable?.name).toBe('posts');

    const builder = selectFromEntity(PostEntity);
    expect(builder.getTable().name).toBe('posts');
  });

  it('accepts TC39 decorator contexts', () => {
    const metadata: Record<PropertyKey, unknown> = {};
    const fieldInitializers: Array<(this: any) => void> = [];
    const classInitializers: Array<(this: any) => void> = [];

    class Stage3User {}

    PrimaryKey(col.int())(undefined as unknown as object, {
      kind: 'field',
      name: 'id',
      metadata,
      static: false,
      private: false,
      addInitializer: init => fieldInitializers.push(init)
    } as any);

    Column(col.varchar(50))(undefined as unknown as object, {
      kind: 'field',
      name: 'name',
      metadata,
      static: false,
      private: false,
      addInitializer: init => fieldInitializers.push(init)
    } as any);

    Entity({ tableName: 'stage3_users' })(Stage3User as any, {
      kind: 'class',
      name: 'Stage3User',
      metadata,
      addInitializer: init => classInitializers.push(init)
    } as any);

    classInitializers.forEach(init => init.call(Stage3User));
    const instance = new Stage3User();
    fieldInitializers.forEach(init => init.call(instance));

    const table = bootstrapEntities().find(t => t.name === 'stage3_users');
    expect(table?.columns.id.primary).toBe(true);
    expect(table?.columns.name.type).toBe('VARCHAR');
  });

  it('defaults belongsTo foreignKey to <property>_id when omitted', () => {
    bootstrapEntities();
    const table = getTableDefFromEntity(DefaultBelongsToPost);
    const relation = table?.relations.user;
    expect(relation?.type).toBe('BELONGS_TO');
    if (relation?.type === 'BELONGS_TO') {
      expect(relation.foreignKey).toBe('user_id');
    }
  });

  it('defaults hasOne foreignKey to <RootEntity>_id when omitted', () => {
    bootstrapEntities();
    const table = getTableDefFromEntity(DefaultHasOneAccount);
    const relation = table?.relations.profile;
    expect(relation?.type).toBe('HAS_ONE');
    if (relation?.type === 'HAS_ONE') {
      expect(relation.foreignKey).toBe('default_has_one_account_id');
    }
  });

  it('defaults hasMany foreignKey to <RootEntity>_id when omitted', () => {
    bootstrapEntities();
    const table = getTableDefFromEntity(DefaultHasManyParent);
    const relation = table?.relations.children;
    expect(relation?.type).toBe('HAS_MANY');
    if (relation?.type === 'HAS_MANY') {
      expect(relation.foreignKey).toBe('default_has_many_parent_id');
    }
  });

  it('defaults belongsToMany pivot foreign keys when omitted', () => {
    bootstrapEntities();
    const table = getTableDefFromEntity(Post);
    const relation = table?.relations.tags;
    expect(relation?.type).toBe('BELONGS_TO_MANY');
    if (relation?.type === 'BELONGS_TO_MANY') {
      expect(relation.pivotForeignKeyToRoot).toBe('post_id');
      expect(relation.pivotForeignKeyToTarget).toBe('tag_id');
    }
  });
});


