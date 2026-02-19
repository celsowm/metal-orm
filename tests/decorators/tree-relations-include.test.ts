import { beforeEach, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { RelationKinds } from '../../src/schema/relation.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { Column, PrimaryKey } from '../../src/decorators/column-decorator.js';
import { Entity } from '../../src/decorators/entity.js';
import { bootstrapEntities, selectFromEntity } from '../../src/decorators/bootstrap.js';
import { Tree, TreeChildren, TreeParent } from '../../src/tree/tree-decorator.js';

describe('tree decorators register include relations', () => {
  beforeEach(() => {
    clearEntityMetadata();
  });

  it('supports include on parent/children when @Tree is above @Entity', () => {
    @Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght' })
    @Entity({ tableName: 'capitulo' })
    class Capitulo {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.int())
      parent_id?: number;

      @Column(col.int())
      lft?: number;

      @Column(col.int())
      rght?: number;

      @TreeParent()
      parent?: Capitulo;

      @TreeChildren()
      capitulos?: Capitulo[];
    }

    bootstrapEntities();
    const table = selectFromEntity(Capitulo).getTable();

    expect(table.relations.parent.type).toBe(RelationKinds.BelongsTo);
    expect(table.relations.parent.foreignKey).toBe('parent_id');
    expect(table.relations.capitulos.type).toBe(RelationKinds.HasMany);
    expect(table.relations.capitulos.foreignKey).toBe('parent_id');

    expect(() => selectFromEntity(Capitulo).include('parent')).not.toThrow();
    expect(() => selectFromEntity(Capitulo).include('capitulos')).not.toThrow();
  });

  it('supports include on parent/children when @Entity is above @Tree', () => {
    @Entity({ tableName: 'menu_item' })
    @Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght' })
    class MenuItem {
      @PrimaryKey(col.int())
      id!: number;

      @Column(col.int())
      parent_id?: number;

      @Column(col.int())
      lft?: number;

      @Column(col.int())
      rght?: number;

      @TreeParent()
      parent?: MenuItem;

      @TreeChildren()
      children?: MenuItem[];
    }

    bootstrapEntities();

    expect(() => selectFromEntity(MenuItem).include('parent')).not.toThrow();
    expect(() => selectFromEntity(MenuItem).include('children')).not.toThrow();
  });
});
