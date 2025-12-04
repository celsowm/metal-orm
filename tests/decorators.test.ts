import { describe, expect, it } from 'vitest';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column.js';
import { hasMany, belongsTo } from '../src/schema/relation.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../src/decorators/index.js';

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
});
