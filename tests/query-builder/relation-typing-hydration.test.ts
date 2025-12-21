import { describe, expect, it } from 'vitest';

import { col } from '../../src/schema/column-types.js';
import { defineTable, setRelations } from '../../src/schema/table.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { ColumnNode } from '../../src/core/ast/expression.js';
import {
  Entity,
  Column,
  PrimaryKey,
  BelongsTo,
  bootstrapEntities,
  selectFromEntity,
} from '../../src/decorators/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';

const userTable = defineTable('relation_users', {
  id: col.primaryKey(col.int()),
  firstName: col.varchar(255),
  email: col.varchar(255),
});

const postTable = defineTable('relation_posts', {
  id: col.primaryKey(col.int()),
  title: col.varchar(255),
  userId: col.int(),
});

setRelations(postTable, {
  user: belongsTo(userTable, 'userId'),
});

setRelations(userTable, {
  posts: hasMany(postTable, 'userId'),
});

describe('relation typing and hydration safety', () => {
  it('flags invalid include columns at compile time', () => {
    const qb = new SelectQueryBuilder(postTable);

    // @ts-expect-error Column 'nonexistent' does not exist on relation 'user'
    const includeInvalidColumn = () => qb.include('user', { columns: ['nonexistent'] });
    expect(includeInvalidColumn).toThrowError(/Column 'nonexistent' not found on relation 'user'/);
  });

  it('keeps the relation target primary key for hydration', () => {
    const qb = new SelectQueryBuilder(postTable)
      .select('id', 'title')
      .include('user', { columns: ['firstName', 'email'] });

    const columnNames = qb.getAST().columns?.map(col => {
      const node = col as ColumnNode;
      return node.alias ?? node.name;
    }) ?? [];

    expect(columnNames).toContain('user__id');

    const plan = qb.getHydrationPlan();
    const relationPlan = plan?.relations.find(rel => rel.name === 'user');

    expect(relationPlan).toBeDefined();
    expect(relationPlan?.columns).toContain('id');
  });

  it('throws when trying to project columns on a missing relation', () => {
    const qb = new SelectQueryBuilder(postTable);
    expect(() => qb.include('notARelation', { columns: ['firstName'] })).toThrowError(
      /Relation 'notARelation' not found/
    );
  });

  it('works with decorated Level 3 entities', () => {
    @Entity()
    class LevelThreeUser {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      firstName!: string;

      @Column(col.varchar(255))
      email!: string;
    }

    @Entity()
    class LevelThreePost {
      @PrimaryKey(col.primaryKey(col.int()))
      id!: number;

      @Column(col.varchar(255))
      title!: string;

      @Column(col.int())
      userId!: number;

      @BelongsTo({
        target: () => LevelThreeUser,
        foreignKey: 'userId',
      })
      user!: LevelThreeUser;
    }

    try {
      bootstrapEntities();
      const query = selectFromEntity(LevelThreePost)
        .select('id', 'title')
        .include('user', { columns: ['firstName', 'email'] });

      const aliasList = (query.getAST().columns ?? []).map(col => {
        const node = col as ColumnNode;
        return node.alias ?? node.name;
      });
      expect(aliasList).toContain('user__firstName');

      const plan = query.getHydrationPlan();
      expect(plan?.relations.some(relation => relation.name === 'user')).toBe(true);
    } finally {
      clearEntityMetadata();
    }
  });
});
