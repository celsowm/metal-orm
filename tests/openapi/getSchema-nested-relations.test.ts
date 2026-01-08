import { describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';

const authors = defineTable('authors', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
});

const posts = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  content: col.text(),
  authorId: col.int(),
});

const comments = defineTable('comments', {
  id: col.primaryKey(col.int()),
  content: col.text(),
  postId: col.int(),
  userId: col.int(),
});

const likes = defineTable('likes', {
  id: col.primaryKey(col.int()),
  commentId: col.int(),
  userId: col.int(),
  createdAt: col.timestamp(),
});

setRelations(posts, {
  author: belongsTo(authors, 'authorId'),
  comments: hasMany(comments, 'postId'),
});

setRelations(authors, {
  posts: hasMany(posts, 'authorId'),
});

setRelations(comments, {
  post: belongsTo(posts, 'postId'),
  likes: hasMany(likes, 'commentId'),
});

setRelations(likes, {
  comment: belongsTo(comments, 'commentId'),
});

authors.columns.name.notNull = true;
authors.columns.email.notNull = true;
posts.columns.title.notNull = true;
comments.columns.content.notNull = true;

describe('getSchema() with 1:N:N:N level', () => {
  it('generates schema for 1:N:N:N nested relations with full mode', () => {
    const schema = selectFrom(authors)
      .include({
        posts: {
          include: {
            comments: {
              include: {
                likes: true
              }
            }
          }
        }
      })
      .getSchema({ mode: 'full', maxDepth: 4 });

    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();

    expect(schema.properties.id).toBeDefined();
    expect(schema.properties.id.type).toBe('integer');
    expect(schema.properties.id.format).toBe('int32');

    expect(schema.properties.name).toBeDefined();
    expect(schema.properties.name.type).toBe('string');

    expect(schema.properties.email).toBeDefined();
    expect(schema.properties.email.type).toBe('string');

    expect(schema.properties.posts).toBeDefined();
    expect(schema.properties.posts.type).toBe('array');

    const postsItems = schema.properties.posts.items;
    expect(postsItems).toBeDefined();
    expect(postsItems.properties).toBeDefined();

    expect(postsItems.properties.id).toBeDefined();
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeDefined();

    expect(postsItems.properties.comments).toBeDefined();
    expect(postsItems.properties.comments.type).toBe('array');

    const commentsItems = postsItems.properties.comments.items;
    expect(commentsItems).toBeDefined();
    expect(commentsItems.properties).toBeDefined();

    expect(commentsItems.properties.id).toBeDefined();
    expect(commentsItems.properties.content).toBeDefined();

    expect(commentsItems.properties.likes).toBeDefined();
    expect(commentsItems.properties.likes.type).toBe('array');

    const likesItems = commentsItems.properties.likes.items;
    expect(likesItems).toBeDefined();
    expect(likesItems.properties).toBeDefined();

    expect(likesItems.properties.id).toBeDefined();
    expect(likesItems.properties.commentId).toBeDefined();
    expect(likesItems.properties.userId).toBeDefined();
    expect(likesItems.properties.createdAt).toBeDefined();
    expect(likesItems.properties.createdAt.type).toBe('string');
    expect(likesItems.properties.createdAt.format).toBe('date-time');
  });

  it('generates schema for 1:N:N:N nested relations with selected mode', () => {
    const schema = selectFrom(authors)
      .select('id', 'name')
      .include({
        posts: {
          columns: ['id', 'title'],
        },
      })
      .getSchema({ mode: 'selected' });

    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();

    expect(schema.properties.id).toBeDefined();
    expect(schema.properties.name).toBeDefined();
    expect(schema.properties.email).toBeUndefined();

    expect(schema.properties.posts).toBeDefined();
    expect(schema.properties.posts.type).toBe('array');

    const postsItems = schema.properties.posts.items;
    expect(postsItems.properties.id).toBeDefined();
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeUndefined();
  });

  it('respects maxDepth option for 1:N:N:N relations', () => {
    const schema = selectFrom(authors)
      .include({
        posts: {
          include: {
            comments: {
              include: {
                likes: true
              }
            }
          }
        }
      })
      .getSchema({ mode: 'full', maxDepth: 2 });

    expect(schema.properties.posts).toBeDefined();
    const postsItems = schema.properties.posts.items;
    expect(postsItems.properties.comments).toBeDefined();

    const commentsItems = postsItems.properties.comments.items;
    expect(commentsItems.properties.id).toBeDefined();
    expect(commentsItems.properties.content).toBeDefined();
    expect(commentsItems.properties.likes).toBeUndefined();
  });

  it('handles includePick with nested 1:N:N:N relations', () => {
    const schema = selectFrom(authors)
      .select('id', 'name')
      .include({
        posts: {
          columns: ['id', 'title'],
        },
      })
      .getSchema({ mode: 'selected' });

    expect(schema.properties.posts).toBeDefined();
    const postsItems = schema.properties.posts.items;
    expect(postsItems.properties.id).toBeDefined();
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeUndefined();
  });

  it('generates correct required fields at all levels', () => {
    const schema = selectFrom(authors)
      .include({
        posts: {
          include: {
            comments: {
              include: {
                likes: true
              }
            }
          }
        }
      })
      .getSchema({ mode: 'full', maxDepth: 4 });

    expect(schema.required).toContain('id');
    expect(schema.required).toContain('name');
    expect(schema.required).toContain('email');

    const postsItems = schema.properties.posts.items;
    expect(postsItems.required).toContain('id');
    expect(postsItems.required).toContain('title');

    const commentsItems = postsItems.properties.comments.items;
    expect(commentsItems.required).toContain('id');
    expect(commentsItems.required).toContain('content');

    const likesItems = commentsItems.properties.likes.items;
    expect(likesItems.required).toContain('id');
  });
});
