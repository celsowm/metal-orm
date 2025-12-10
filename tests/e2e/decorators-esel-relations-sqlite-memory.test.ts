import { describe, expect, it } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq, gt } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column.js';
import type { HasManyCollection, ManyToManyCollection } from '../../src/schema/types.js';
import {
  bootstrapEntities,
  Column,
  Entity,
  HasMany,
  BelongsTo,
  BelongsToMany,
  PrimaryKey,
  getTableDefFromEntity,
  selectFromEntity
} from '../../src/decorators/index.js';
import { esel } from '../../src/query-builder/select-helpers.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import {
  closeDb,
  createSqliteSessionFromDb,
  execSql,
  runSql
} from './sqlite-helpers.ts';

@Entity()
class Member {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  name!: string;

  @Column(col.notNull(col.varchar(255)))
  email!: string;

  @HasMany({ target: () => Article, foreignKey: 'memberId' })
  posts!: HasManyCollection<Article>;

  @BelongsToMany({
    target: () => Role,
    pivotTable: () => MemberRole,
    pivotForeignKeyToRoot: 'memberId',
    pivotForeignKeyToTarget: 'roleId',
    defaultPivotColumns: ['assignedAt']
  })
  roles!: ManyToManyCollection<Role>;
}

@Entity()
class Article {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(255)))
  title!: string;

  @Column(col.notNull(col.int()))
  memberId!: number;

  @BelongsTo({ target: () => Member, foreignKey: 'memberId' })
  member?: Member;
}

@Entity()
class Role {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.varchar(120)))
  name!: string;

  @BelongsToMany({
    target: () => Member,
    pivotTable: () => MemberRole,
    pivotForeignKeyToRoot: 'roleId',
    pivotForeignKeyToTarget: 'memberId',
    defaultPivotColumns: ['assignedAt']
  })
  members!: ManyToManyCollection<Member>;
}

@Entity()
class MemberRole {
  @PrimaryKey(col.autoIncrement(col.int()))
  id!: number;

  @Column(col.notNull(col.int()))
  memberId!: number;

  @Column(col.notNull(col.int()))
  roleId!: number;

  @Column(col.notNull(col.varchar(50)))
  assignedAt!: string;
}

describe('decorators + esel helpers with relations (sqlite)', () => {
  it('hydrates hasMany and belongsToMany relations while keeping selections terse with esel()', async () => {
    const db = new sqlite3.Database(':memory:');

    try {
      const tables = bootstrapEntities();
      const memberTable = getTableDefFromEntity(Member)!;
      const articleTable = getTableDefFromEntity(Article)!;
      const roleTable = getTableDefFromEntity(Role)!;
      const pivotTable = getTableDefFromEntity(MemberRole)!;

      expect(memberTable.name).toBe('members');
      expect(articleTable.name).toBe('articles');
      expect(roleTable.name).toBe('roles');
      expect(pivotTable.name).toBe('member_roles');
      expect(tables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'members' }),
          expect.objectContaining({ name: 'articles' }),
          expect.objectContaining({ name: 'roles' }),
          expect.objectContaining({ name: 'member_roles' })
        ])
      );

      await execSql(
        db,
        `
          CREATE TABLE members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL
          );
        `
      );

      await execSql(
        db,
        `
          CREATE TABLE articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            memberId INTEGER NOT NULL
          );
        `
      );

      await execSql(
        db,
        `
          CREATE TABLE roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
          );
        `
      );

      await execSql(
        db,
        `
          CREATE TABLE member_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memberId INTEGER NOT NULL,
            roleId INTEGER NOT NULL,
            assignedAt TEXT NOT NULL
          );
        `
      );

      await runSql(db, 'INSERT INTO members (id, name, email) VALUES (?, ?, ?);', [
        1,
        'Ada Lovelace',
        'ada@example.com'
      ]);
      await runSql(db, 'INSERT INTO members (id, name, email) VALUES (?, ?, ?);', [
        2,
        'Grace Hopper',
        'grace@example.com'
      ]);

      await runSql(db, 'INSERT INTO articles (id, title, memberId) VALUES (?, ?, ?);', [
        1,
        'Notes on the Analytical Engine',
        1
      ]);
      await runSql(db, 'INSERT INTO articles (id, title, memberId) VALUES (?, ?, ?);', [
        2,
        'Finding the First Bug',
        1
      ]);
      await runSql(db, 'INSERT INTO articles (id, title, memberId) VALUES (?, ?, ?);', [
        3,
        'Compiler Construction 101',
        2
      ]);

      await runSql(db, 'INSERT INTO roles (id, name) VALUES (?, ?);', [1, 'admin']);
      await runSql(db, 'INSERT INTO roles (id, name) VALUES (?, ?);', [2, 'editor']);
      await runSql(db, 'INSERT INTO roles (id, name) VALUES (?, ?);', [3, 'reviewer']);

      await runSql(
        db,
        'INSERT INTO member_roles (id, memberId, roleId, assignedAt) VALUES (?, ?, ?, ?);',
        [1, 1, 1, '2024-01-01']
      );
      await runSql(
        db,
        'INSERT INTO member_roles (id, memberId, roleId, assignedAt) VALUES (?, ?, ?, ?);',
        [2, 1, 2, '2024-02-10']
      );
      await runSql(
        db,
        'INSERT INTO member_roles (id, memberId, roleId, assignedAt) VALUES (?, ?, ?, ?);',
        [3, 2, 2, '2024-03-05']
      );

      const session = createSqliteSessionFromDb(db);

      const memberSelection = esel(Member, 'id', 'name', 'email');
      const [ada] = await selectFromEntity(Member)
        .select(memberSelection)
        .where(eq(memberSelection.name, 'Ada Lovelace'))
        .includeLazy('posts')
        .includeLazy('roles')
        .execute(session);

      expect(ada).toBeDefined();
      expect(ada!.email).toBe('ada@example.com');

      const adaPosts = await (ada!.posts as HasManyCollection<Article>).load();
      expect(adaPosts.map(p => p.title).sort()).toEqual(
        ['Finding the First Bug', 'Notes on the Analytical Engine'].sort()
      );

      const adaRoles = await (ada!.roles as ManyToManyCollection<Role>).load();
      expect(adaRoles.map(r => r.name).sort()).toEqual(['admin', 'editor'].sort());
      const adminPivot = (adaRoles.find(r => r.name === 'admin') as any)._pivot;
      expect(adminPivot.assignedAt).toBe('2024-01-01');

      const eagerMembers = await selectFromEntity(Member)
        .select(esel(Member, 'id', 'name'))
        .include('posts', { columns: ['id', 'title'] })
        .include('roles', { columns: ['id', 'name'], pivot: { columns: ['assignedAt'] } })
        .where(gt(memberTable.columns.id, 0))
        .orderBy(memberTable.columns.id)
        .execute(session);

      expect(eagerMembers).toHaveLength(2);

      const grace = eagerMembers.find(m => m.name === 'Grace Hopper');
      expect(grace).toBeDefined();

      const gracePosts = (grace!.posts as HasManyCollection<Article>).getItems();
      expect(gracePosts.map(p => p.title)).toEqual(['Compiler Construction 101']);

      const graceRoles = (grace!.roles as ManyToManyCollection<Role>).getItems();
      expect(graceRoles.map(r => r.name)).toEqual(['editor']);
      expect((graceRoles[0] as any)._pivot.assignedAt).toBe('2024-03-05');

      const editors = await new SelectQueryBuilder(memberTable)
        .select(esel(Member, 'id', 'name'))
        .match('roles', eq(roleTable.columns.name, 'editor'))
        .orderBy(memberTable.columns.id)
        .execute(session);

      expect(editors.map(e => e.name)).toEqual(['Ada Lovelace', 'Grace Hopper']);
    } finally {
      await closeDb(db);
    }
  });
});
