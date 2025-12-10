import { describe, it, expect } from 'vitest';

import { col } from '../../src/schema/column.js';
import { defineTable } from '../../src/schema/table.js';
import { hasMany, belongsTo } from '../../src/schema/relation.js';
import { SelectQueryBuilder } from '../../src/query-builder/select.js';
import { sel, esel } from '../../src/query-builder/select-helpers.js';
import {
  Entity,
  Column as ColumnDecorator,
  PrimaryKey,
  bootstrapEntities
} from '../../src/decorators/index.js';

@Entity()
class AuthorEntity {
  @PrimaryKey(col.primaryKey(col.int()))
  id!: number;

  @ColumnDecorator(col.varchar(255))
  name!: string;
}

describe('select helpers and builder sugar', () => {
  const authorTable = defineTable('authors', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255)
  });

  const bookTable = defineTable('books', {
    id: col.primaryKey(col.int()),
    title: col.varchar(255),
    authorId: col.int()
  });

  authorTable.relations = {
    books: hasMany(bookTable, 'authorId')
  };

  bookTable.relations = {
    author: belongsTo(authorTable, 'authorId')
  };

  it('sel builds a typed selection map from a table', () => {
    const selection = sel(authorTable, 'id', 'name');

    expect(Object.keys(selection)).toEqual(['id', 'name']);
    expect(selection.id.name).toBe('id');
    expect(selection.name.name).toBe('name');
  });

  it('esel builds a typed selection map from an entity', () => {
    // Bootstrap metadata once to make the entity table available
    bootstrapEntities();

    const selection = esel(AuthorEntity, 'id', 'name');

    expect(Object.keys(selection)).toEqual(['id', 'name']);
    expect(selection.id.name).toBe('id');
    expect(selection.name.name).toBe('name');
  });

  it('selectColumns picks root columns by name', () => {
    const qb = new SelectQueryBuilder(authorTable).selectColumns('id', 'name');
    const ast = qb.getAST();
    const aliases = ast.columns?.map(c => (c as any).alias || (c as any).name);

    expect(aliases).toEqual(expect.arrayContaining(['id', 'name']));
  });

  it('selectRelationColumns projects relation columns and joins the relation', () => {
    const qb = new SelectQueryBuilder(authorTable).selectRelationColumns('books', 'id', 'title');
    const ast = qb.getAST();
    const aliases = ast.columns?.map(c => (c as any).alias || (c as any).name);

    expect(aliases).toEqual(expect.arrayContaining(['books__id', 'books__title', 'id']));
    expect(ast.joins?.length).toBeGreaterThan(0);
  });

  it('selectColumnsDeep fans out selection to root and relations', () => {
    const qb = new SelectQueryBuilder(authorTable).selectColumnsDeep({
      root: ['id', 'name'],
      books: ['title']
    });
    const ast = qb.getAST();
    const aliases = ast.columns?.map(c => (c as any).alias || (c as any).name);

    expect(aliases).toEqual(expect.arrayContaining(['id', 'name', 'books__title']));
  });

  it('includePick is a shorthand for selecting specific relation columns', () => {
    const qb = new SelectQueryBuilder(authorTable).includePick('books', ['title']);
    const ast = qb.getAST();
    const aliases = ast.columns?.map(c => (c as any).alias || (c as any).name);

    expect(aliases).toEqual(expect.arrayContaining(['books__title', 'id']));
    expect(ast.joins?.length).toBeGreaterThan(0);
  });
});
