import { afterAll, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { RelationKinds } from '../../src/schema/relation.js';
import {
  Column,
  Entity,
  HasMany,
  PrimaryKey,
  getDecoratorMetadata
} from '../../src/decorators/index.js';

const originalMetadataSymbol = (Symbol as { metadata?: symbol }).metadata;
const testMetadataSymbol = originalMetadataSymbol ?? Symbol('metadata');

if (!originalMetadataSymbol) {
  (Symbol as { metadata?: symbol }).metadata = testMetadataSymbol;
}

afterAll(() => {
  if (!originalMetadataSymbol) {
    delete (Symbol as { metadata?: symbol }).metadata;
  }
});

describe('getDecoratorMetadata', () => {
  it('reads standard decorator metadata from a class constructor', () => {
    const metadata: Record<PropertyKey, unknown> = {};
    const fieldInitializers: Array<(this: unknown) => void> = [];
    const classInitializers: Array<(this: unknown) => void> = [];

    class Stage3Post {}
    class Stage3Comment {}

    PrimaryKey(col.int())(undefined as unknown as object, {
      kind: 'field',
      name: 'id',
      metadata,
      static: false,
      private: false,
      addInitializer: init => fieldInitializers.push(init)
    } as any);

    Column(col.varchar(255))(undefined as unknown as object, {
      kind: 'field',
      name: 'title',
      metadata,
      static: false,
      private: false,
      addInitializer: init => fieldInitializers.push(init)
    } as any);

    HasMany({ target: () => Stage3Comment, foreignKey: 'post_id' })(undefined as unknown as object, {
      kind: 'field',
      name: 'comments',
      metadata,
      static: false,
      private: false,
      addInitializer: init => fieldInitializers.push(init)
    } as any);

    Entity({ tableName: 'stage3_posts' })(Stage3Post as any, {
      kind: 'class',
      name: 'Stage3Post',
      metadata,
      addInitializer: init => classInitializers.push(init)
    } as any);

    classInitializers.forEach(init => init.call(Stage3Post));
    const instance = new Stage3Post();
    fieldInitializers.forEach(init => init.call(instance));

    (Stage3Post as Record<PropertyKey, unknown>)[testMetadataSymbol] = metadata;

    const bag = getDecoratorMetadata(Stage3Post);
    expect(bag).toBeDefined();
    expect(bag?.columns.map(entry => entry.propertyName)).toEqual(
      expect.arrayContaining(['id', 'title'])
    );
    expect(bag?.columns.find(entry => entry.propertyName === 'id')?.column.primary).toBe(true);
    expect(bag?.relations).toHaveLength(1);
    expect(bag?.relations[0].propertyName).toBe('comments');
    expect(bag?.relations[0].relation.kind).toBe(RelationKinds.HasMany);
  });
});
