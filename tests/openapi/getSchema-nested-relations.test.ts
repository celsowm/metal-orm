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
    const { output } = selectFrom(authors)
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

    expect(output.type).toBe('object');
    expect(output.properties).toBeDefined();

    expect(output.properties.id).toBeDefined();
    expect(output.properties.id.type).toBe('integer');
    expect(output.properties.id.format).toBe('int32');

    expect(output.properties.name).toBeDefined();
    expect(output.properties.name.type).toBe('string');

    expect(output.properties.email).toBeDefined();
    expect(output.properties.email.type).toBe('string');

    expect(output.properties.posts).toBeDefined();
    expect(output.properties.posts.type).toBe('array');

    const postsItems = output.properties.posts.items;
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
    const { output } = selectFrom(authors)
      .select('id', 'name')
      .include({
        posts: {
          columns: ['id', 'title'],
        },
      })
      .getSchema({ mode: 'selected' });

    expect(output.type).toBe('object');
    expect(output.properties).toBeDefined();

    expect(output.properties.id).toBeDefined();
    expect(output.properties.name).toBeDefined();
    expect(output.properties.email).toBeUndefined();

    expect(output.properties.posts).toBeDefined();
    expect(output.properties.posts.type).toBe('array');

    const postsItems = output.properties.posts.items;
    expect(postsItems.properties.id).toBeDefined();
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeUndefined();
  });

  it('respects maxDepth option for 1:N:N:N relations', () => {
    const { output } = selectFrom(authors)
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

    expect(output.properties.posts).toBeDefined();
    const postsItems = output.properties.posts.items;
    expect(postsItems.properties.comments).toBeDefined();

    const commentsItems = postsItems.properties.comments.items;
    expect(commentsItems.properties.id).toBeDefined();
    expect(commentsItems.properties.content).toBeDefined();
    expect(commentsItems.properties.likes).toBeUndefined();
  });

  it('handles includePick with nested 1:N:N:N relations', () => {
    const { output } = selectFrom(authors)
      .select('id', 'name')
      .include({
        posts: {
          columns: ['id', 'title'],
        },
      })
      .getSchema({ mode: 'selected' });

    expect(output.properties.posts).toBeDefined();
    const postsItems = output.properties.posts.items;
    expect(postsItems.properties.id).toBeDefined();
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeUndefined();
  });

  it('generates correct required fields at all levels', () => {
    const { output } = selectFrom(authors)
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

    expect(output.required).toContain('id');
    expect(output.required).toContain('name');
    expect(output.required).toContain('email');

    const postsItems = output.properties.posts.items;
    expect(postsItems.required).toContain('id');
    expect(postsItems.required).toContain('title');

    const commentsItems = postsItems.properties.comments.items;
    expect(commentsItems.required).toContain('id');
    expect(commentsItems.required).toContain('content');

    const likesItems = commentsItems.properties.likes.items;
    expect(likesItems.required).toContain('id');
  });

  it('generates input schema with relation payloads', () => {
    const { input } = selectFrom(authors).getSchema({
      input: {
        mode: 'create',
        excludePrimaryKey: true,
        relationMode: 'mixed',
        maxDepth: 2
      }
    });

    expect(input).toBeDefined();
    const inputSchema = input!;

    expect(inputSchema.type).toBe('object');
    expect(inputSchema.properties.id).toBeUndefined();
    expect(inputSchema.required).toContain('name');
    expect(inputSchema.required).toContain('email');

    const postsSchema = inputSchema.properties.posts;
    expect(postsSchema.type).toBe('array');
    const postsItems = postsSchema.items!;
    expect(postsItems).toBeDefined();
    const anyOf = postsItems.anyOf ?? [];
    expect(anyOf.length).toBeGreaterThan(0);
    expect(anyOf.some(item => item.type === 'object')).toBe(true);
  });

  it('applies relation selections and removes relation foreign keys in input schemas', () => {
    const authorInput = defineTable('authors_input_selection', {
      id: col.primaryKey(col.int()),
      name: col.varchar(255),
    });

    const postInput = defineTable('posts_input_selection', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
      content: col.text(),
      authorId: col.int(),
      createdAt: col.timestamp(),
    });

    setRelations(postInput, {
      author: belongsTo(authorInput, 'authorId'),
    });

    setRelations(authorInput, {
      posts: hasMany(postInput, 'authorId'),
    });

    authorInput.columns.name.notNull = true;
    postInput.columns.title.notNull = true;
    postInput.columns.authorId.notNull = true;
    postInput.columns.createdAt.notNull = true;

    const { input } = selectFrom(authorInput).getSchema({
      input: {
        mode: 'create',
        includeRelations: true,
        relationMode: 'objects',
        excludePrimaryKey: true,
        relationSelections: {
          posts: { omit: ['createdAt'] }
        },
        excludeRelationForeignKeys: true
      }
    });

    const postsSchema = input!.properties.posts;
    expect(postsSchema.type).toBe('array');
    const postsItems = postsSchema.items!;

    expect(postsItems.type).toBe('object');
    expect(postsItems.properties.title).toBeDefined();
    expect(postsItems.properties.content).toBeDefined();
    expect(postsItems.properties.authorId).toBeUndefined();
    expect(postsItems.properties.createdAt).toBeUndefined();
    expect(postsItems.required).toContain('title');
    expect(postsItems.required).not.toContain('authorId');
    expect(postsItems.required).not.toContain('createdAt');
  });
});
