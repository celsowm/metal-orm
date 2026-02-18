import { describe, it, expect, beforeEach } from 'vitest';
import { defineTable } from '../../src/schema/table.js';
import { addRelation } from '../../src/schema/table.js';
import { col } from '../../src/schema/column-types.js';
import { hasMany, hasOne, belongsTo, RelationKinds } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { Entity } from '../../src/decorators/entity.js';
import { Column } from '../../src/decorators/column-decorator.js';
import { bootstrapEntities, addEntityRelation } from '../../src/decorators/bootstrap.js';
import { getAllEntityMetadata, getEntityMetadata } from '../../src/orm/entity-metadata.js';

// ─── Schema-style tables ──────────────────────────────────────────────────────

const PostsTable = defineTable('posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  user_id: col.int(),
});

const CommentsTable = defineTable('comments', {
  id: col.primaryKey(col.int()),
  body: col.text(),
  post_id: col.int(),
  user_id: col.int(),
});

const TagsTable = defineTable('tags', {
  id: col.primaryKey(col.int()),
  name: col.varchar(100),
});

const UsersTable = defineTable('users_ref', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
});

// ─── Tests: schema-style ──────────────────────────────────────────────────────

describe('addRelation (schema-style tables)', () => {
  it('adds a hasMany relation to a table with no prior relations', () => {
    const users = defineTable('users_fresh', { id: col.primaryKey(col.int()) });
    expect(Object.keys(users.relations)).toHaveLength(0);

    addRelation(users, 'posts', hasMany(PostsTable, 'user_id'));

    expect(Object.keys(users.relations)).toHaveLength(1);
    const rel = users.relations['posts'];
    expect(rel.type).toBe(RelationKinds.HasMany);
  });

  it('adds a hasOne relation', () => {
    const authors = defineTable('authors', { id: col.primaryKey(col.int()) });
    addRelation(authors, 'latestPost', hasOne(PostsTable, 'user_id'));

    const rel = authors.relations['latestPost'];
    expect(rel.type).toBe(RelationKinds.HasOne);
    expect((rel as { foreignKey: string }).foreignKey).toBe('user_id');
  });

  it('adds a belongsTo relation', () => {
    const posts = defineTable('posts_clone', {
      id: col.primaryKey(col.int()),
      user_id: col.int(),
    });
    addRelation(posts, 'author', belongsTo(UsersTable, 'user_id'));

    const rel = posts.relations['author'];
    expect(rel.type).toBe(RelationKinds.BelongsTo);
  });

  it('replaces an existing relation with the same name', () => {
    const tbl = defineTable('tbl_replace', { id: col.primaryKey(col.int()) });
    addRelation(tbl, 'items', hasMany(CommentsTable, 'post_id'));
    addRelation(tbl, 'items', hasMany(TagsTable, 'post_id')); // overwrite

    const rel = tbl.relations['items'];
    expect((rel as { target: { name: string } }).target.name).toBe('tags');
  });

  it('added relation is visible to SelectQueryBuilder.include()', () => {
    const tbl = defineTable('posts_qb', {
      id: col.primaryKey(col.int()),
      title: col.varchar(255),
    });
    addRelation(tbl, 'comments', hasMany(CommentsTable, 'post_id'));

    // Should not throw — the relation exists
    const qb = new SelectQueryBuilder(tbl).include('comments');
    const plan = qb.getHydrationPlan();
    expect(plan).toBeDefined();
    const relPlan = plan!.relations.find(r => r.name === 'comments');
    expect(relPlan).toBeDefined();
  });

  it('can add multiple relations independently', () => {
    const hub = defineTable('hub', { id: col.primaryKey(col.int()) });
    addRelation(hub, 'posts', hasMany(PostsTable, 'user_id'));
    addRelation(hub, 'comments', hasMany(CommentsTable, 'user_id'));

    expect(Object.keys(hub.relations)).toHaveLength(2);
    expect(hub.relations['posts']).toBeDefined();
    expect(hub.relations['comments']).toBeDefined();
  });
});

// ─── Decorator-based entities ─────────────────────────────────────────────────

// Defined at module scope so decorators run at class-definition time (not inside functions)
@Entity({ tableName: 'comment_ents' })
class CommentEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'int' }) post_id!: number;
}

@Entity({ tableName: 'post_ents' })
class PostEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'varchar' }) title!: string;
}

@Entity({ tableName: 'tag_ents' })
class TagEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'varchar' }) name!: string;
}

@Entity({ tableName: 'article_ents' })
class ArticleEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'varchar' }) title!: string;
}

@Entity({ tableName: 'node_ents' })
class NodeEntity {
  @Column({ type: 'int', primary: true }) id!: number;
}

@Entity({ tableName: 'leaf_ents' })
class LeafEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'int' }) node_id!: number;
}

@Entity({ tableName: 'branch_ents' })
class BranchEntity {
  @Column({ type: 'int', primary: true }) id!: number;
  @Column({ type: 'int' }) node_id!: number;
}

describe('addEntityRelation (decorator-based entities)', () => {
  beforeEach(() => {
    // Reset the cached TableDef on each meta so every test starts with a
    // fresh bootstrap, while keeping the decorator registrations intact.
    for (const meta of getAllEntityMetadata()) {
      meta.table = undefined;
      // Also clear any on-the-fly relations from the previous test
      meta.relations = { ...meta.relations };
    }
  });

  it('adds a relation before bootstrapEntities and it survives bootstrap', () => {
    // Add the relation BEFORE bootstrap
    addEntityRelation(PostEntity, 'comments', {
      kind: RelationKinds.HasMany,
      propertyKey: 'comments',
      target: () => CommentEntity,
      foreignKey: 'post_id',
    });

    // Now bootstrap — should compile and include the relation
    bootstrapEntities();

    const meta = getEntityMetadata(PostEntity as never);
    expect(meta?.table?.relations['comments']).toBeDefined();
    expect(meta?.table?.relations['comments'].type).toBe(RelationKinds.HasMany);
  });

  it('patches the table immediately when added after bootstrapEntities', () => {
    // Bootstrap first
    bootstrapEntities();

    // Add relation AFTER bootstrap — should patch immediately
    addEntityRelation(ArticleEntity, 'tags', {
      kind: RelationKinds.HasMany,
      propertyKey: 'tags',
      target: () => TagEntity,
      foreignKey: 'article_id',
    });

    const meta = getEntityMetadata(ArticleEntity as never);
    expect(meta?.table?.relations['tags']).toBeDefined();
    expect(meta?.table?.relations['tags'].type).toBe(RelationKinds.HasMany);
  });

  it('overwrites an existing relation when added with the same name after bootstrap', () => {
    bootstrapEntities();

    // Add then overwrite
    addEntityRelation(NodeEntity, 'children', {
      kind: RelationKinds.HasMany,
      propertyKey: 'children',
      target: () => LeafEntity,
      foreignKey: 'node_id',
    });

    addEntityRelation(NodeEntity, 'children', {
      kind: RelationKinds.HasMany,
      propertyKey: 'children',
      target: () => BranchEntity,
      foreignKey: 'node_id',
    });

    const meta = getEntityMetadata(NodeEntity as never);
    const rel = meta?.table?.relations['children'] as { target: { name: string } } | undefined;
    expect(rel?.target.name).toBe('branch_ents');
  });

  it('throws when called on an unregistered class', () => {
    class Unregistered {}

    expect(() => {
      addEntityRelation(Unregistered as never, 'things', {
        kind: RelationKinds.HasMany,
        propertyKey: 'things',
        target: () => Unregistered as never,
        foreignKey: 'root_id',
      });
    }).toThrow(/not registered/);
  });
});
