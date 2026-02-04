/// <reference types="vitest" />

import { describe, it, expect } from 'vitest';
import { col, defineTable } from '../../src/index.js';
import { PrimaryKey, Entity, Column } from '../../src/index.js';
import { Tree } from '../../src/index.js';
import {
  treeNodeToOpenApiSchema,
  treeNodeResultToOpenApiSchema,
  threadedNodeToOpenApiSchema,
  treeListEntryToOpenApiSchema,
  generateTreeComponents,
  type OpenApiSchema,
} from '../../src/dto/openapi/index.js';

@Entity()
class Category {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.int())
  parentId?: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;

  @Column(col.notNull(col.int()))
  lft!: number;

  @Column(col.notNull(col.int()))
  rght!: number;

  @Column(col.int())
  depth?: number;
}

@Entity()
@Tree({ parentKey: 'parentRef' })
class DecoratedCategory {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.int())
  parentRef?: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;

  @Column(col.notNull(col.int()))
  lft!: number;

  @Column(col.notNull(col.int()))
  rght!: number;
}

@Entity()
@Tree({ parentKey: 'parentId' })
class DecoratedParentOnlyCategory {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.int())
  parentId?: number;

  @Column(col.notNull(col.varchar(100)))
  name!: string;
}

const categoriesTable = defineTable('categories', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  parentId: col.int(),
  name: col.notNull(col.varchar(100)),
  lft: col.notNull(col.int()),
  rght: col.notNull(col.int()),
  depth: col.int(),
});

const categoriesParentOnly = defineTable('categories_parent_only', {
  id: col.primaryKey(col.autoIncrement(col.int())),
  parentId: col.int(),
  name: col.notNull(col.varchar(100)),
});

describe('Tree OpenAPI Schema Generation', () => {
  it('generates tree node schema with metadata', () => {
    const schema = treeNodeToOpenApiSchema(categoriesTable, {
      exclude: ['lft', 'rght', 'depth'],
    });

    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.entity).toBeDefined();
    expect(schema.properties!.lft).toBeDefined();
    expect(schema.properties!.rght).toBeDefined();
    expect(schema.properties!.isLeaf).toBeDefined();
    expect(schema.properties!.isRoot).toBeDefined();
    expect(schema.properties!.childCount).toBeDefined();

    const entitySchema = schema.properties!.entity as OpenApiSchema;
    expect(entitySchema.properties!.name).toBeDefined();
    expect(entitySchema.properties!.lft).toBeUndefined();
    expect(entitySchema.properties!.rght).toBeUndefined();
    expect(entitySchema.properties!.depth).toBeUndefined();
  });

  it('omits depth when includeTreeMetadata is false', () => {
    const schema = treeNodeToOpenApiSchema(categoriesTable, {
      includeTreeMetadata: false,
    });

    expect(schema.properties!.depth).toBeUndefined();
  });

  it('generates tree node result schema with parentId and data', () => {
    const schema = treeNodeResultToOpenApiSchema(categoriesTable, {
      parentKey: 'parentId',
      includeTreeMetadata: true,
    });

    expect(schema.type).toBe('object');
    expect(schema.properties!.data).toBeDefined();
    expect(schema.properties!.parentId).toBeDefined();
    expect(schema.properties!.lft).toBeDefined();
    expect(schema.properties!.rght).toBeDefined();
    expect(schema.properties!.isLeaf).toBeDefined();
    expect(schema.properties!.isRoot).toBeDefined();
    expect(schema.properties!.depth).toBeDefined();

    const dataSchema = schema.properties!.data as OpenApiSchema;
    expect(dataSchema.properties!.name).toBeDefined();
  });

  it('supports entities with only parentId (no lft/rght columns)', () => {
    const schema = treeNodeResultToOpenApiSchema(categoriesParentOnly, {
      parentKey: 'parentId',
    });

    const dataSchema = schema.properties!.data as OpenApiSchema;
    expect(dataSchema.properties!.parentId).toBeDefined();
    expect(dataSchema.properties!.lft).toBeUndefined();
    expect(dataSchema.properties!.rght).toBeUndefined();

    const parentSchema = schema.properties!.parentId as OpenApiSchema;
    expect(parentSchema.type).toEqual(['integer', 'null']);
    expect(schema.properties!.lft).toBeDefined();
    expect(schema.properties!.rght).toBeDefined();
  });

  it('infers parentKey from @Tree config', () => {
    const schema = treeNodeResultToOpenApiSchema(DecoratedCategory);
    const parentSchema = schema.properties!.parentId as OpenApiSchema;

    expect(parentSchema.type).toEqual(['integer', 'null']);
  });

  it('supports @Tree entity without lft/rght columns', () => {
    const schema = treeNodeResultToOpenApiSchema(DecoratedParentOnlyCategory);

    const dataSchema = schema.properties!.data as OpenApiSchema;
    expect(dataSchema.properties!.parentId).toBeDefined();
    expect(dataSchema.properties!.lft).toBeUndefined();
    expect(dataSchema.properties!.rght).toBeUndefined();

    const parentSchema = schema.properties!.parentId as OpenApiSchema;
    expect(parentSchema.type).toEqual(['integer', 'null']);
    expect(schema.properties!.lft).toBeDefined();
    expect(schema.properties!.rght).toBeDefined();
  });

  it('generates threaded node schema with recursive $ref', () => {
    const schema = threadedNodeToOpenApiSchema(categoriesTable, {
      componentName: 'CategoryTreeNode',
    });

    const childrenSchema = schema.properties!.children as OpenApiSchema;
    expect(childrenSchema.type).toBe('array');
    expect(childrenSchema.items?.$ref).toBe('#/components/schemas/CategoryTreeNode');
  });

  it('supports tree list entry schema options', () => {
    const schema = treeListEntryToOpenApiSchema({
      keyType: 'string',
      valueType: 'integer',
    });

    expect(schema.properties!.key?.type).toBe('string');
    expect(schema.properties!.value?.type).toBe('integer');
    expect(schema.properties!.depth?.type).toBe('integer');
  });

  it('generates tree components with threaded tree references', () => {
    const components = generateTreeComponents(categoriesTable, 'Category');

    expect(components.Category).toBeDefined();
    expect(components.CategoryNode).toBeDefined();
    expect(components.CategoryNodeResult).toBeDefined();
    expect(components.CategoryTreeNode).toBeDefined();
    expect(components.CategoryTreeList).toBeDefined();
    expect(components.CategoryThreadedTree).toBeDefined();

    const threadedTree = components.CategoryThreadedTree as OpenApiSchema;
    expect(threadedTree.type).toBe('array');
    expect(threadedTree.items?.$ref).toBe('#/components/schemas/CategoryTreeNode');
  });

  it('handles entity classes as schema targets', () => {
    const schema = treeNodeToOpenApiSchema(Category, {
      includeTreeMetadata: false,
    });

    const entitySchema = schema.properties!.entity as OpenApiSchema;
    expect(entitySchema.properties!.id).toBeDefined();
    expect(entitySchema.properties!.name).toBeDefined();
  });
});
