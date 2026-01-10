import { describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import { selectFrom } from '../../src/query/index.js';

const authors = defineTable('authors_components', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  email: col.varchar(255),
});

const posts = defineTable('posts_components', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  content: col.text(),
  authorId: col.int(),
});

setRelations(posts, {
  author: belongsTo(authors, 'authorId'),
});

setRelations(authors, {
  posts: hasMany(posts, 'authorId'),
});

authors.columns.name.notNull = true;
authors.columns.email.notNull = true;
posts.columns.title.notNull = true;

describe('getSchema() refMode components', () => {
  it('emits component refs while keeping full schema when selectedRefMode is inline', () => {
    const { output, components } = selectFrom(authors)
      .select('id')
      .include({ posts: { columns: ['id'] } })
      .getSchema({ mode: 'selected', refMode: 'components' });

    expect(components).toBeDefined();
    expect(components?.schemas.authors_components).toBeDefined();
    expect(components?.schemas.posts_components).toBeDefined();

    expect(output.properties.id).toBeDefined();
    expect(output.properties.name).toBeDefined();
    expect(output.properties.email).toBeDefined();

    const postsSchema = output.properties.posts;
    expect(postsSchema.type).toBe('array');
    expect(postsSchema.items?.$ref).toBe('#/components/schemas/posts_components');
  });

  it('emits selection-specific components when selectedRefMode is components', () => {
    const { output, components } = selectFrom(authors)
      .select('id')
      .include({ posts: { columns: ['id'] } })
      .getSchema({
        mode: 'selected',
        refMode: 'components',
        selectedRefMode: 'components'
      });

    expect(components).toBeDefined();

    expect(output.properties.id).toBeDefined();
    expect(output.properties.name).toBeUndefined();
    expect(output.properties.email).toBeUndefined();

    const postsSchema = output.properties.posts;
    const postsRef = postsSchema.items?.$ref;
    expect(postsRef).toMatch(/^#\/components\/schemas\/posts_components__sel_[0-9a-f]{8}$/);

    const postsComponentName = postsRef?.split('/').pop() ?? '';
    const postsComponent = components?.schemas[postsComponentName];
    expect(postsComponent).toBeDefined();
    expect(postsComponent?.properties.id).toBeDefined();
    expect(postsComponent?.properties.title).toBeUndefined();

    const authorComponentName = Object.keys(components?.schemas ?? {})
      .find(name => name.startsWith('authors_components__sel_'));
    expect(authorComponentName).toBeDefined();
  });

  it('can return output as a component $ref', () => {
    const { output, components } = selectFrom(authors)
      .getSchema({ refMode: 'components', outputAsRef: true });

    expect(components).toBeDefined();
    expect(output).toHaveProperty('$ref', '#/components/schemas/authors_components');
  });
});
