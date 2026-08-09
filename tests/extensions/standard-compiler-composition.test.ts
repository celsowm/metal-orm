import { describe, expect, it } from 'vitest';
import type { CompilerContext } from '../../src/core/dialect/abstract.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  UpdateQueryNode
} from '../../src/core/ast/query.js';
import type { ExpressionNode, OperandNode } from '../../src/core/ast/expression.js';
import { StandardLimitOffsetPagination } from '../../src/core/dialect/base/pagination-strategy.js';
import { StandardTableFunctionStrategy } from '../../src/core/functions/standard-table-strategy.js';
import type { StandardSqlCompilerServices } from '../../src/core/dialect/base/standard-sql-services.js';
import { StandardSqlSourceCompiler } from '../../src/core/dialect/base/standard-sql-source-compiler.js';
import { StandardSelectCompiler } from '../../src/core/dialect/base/standard-select-compiler.js';
import { StandardInsertCompiler } from '../../src/core/dialect/base/standard-insert-compiler.js';
import { StandardUpdateCompiler } from '../../src/core/dialect/base/standard-update-compiler.js';
import { StandardDeleteCompiler } from '../../src/core/dialect/base/standard-delete-compiler.js';

const createContext = (): CompilerContext => {
  const params: unknown[] = [];
  return {
    params,
    addParameter(value: unknown): string {
      params.push(value);
      return '?';
    }
  };
};

const quoteIdentifier = (id: string): string => `"${id}"`;

const compileOperand = (node: OperandNode, ctx: CompilerContext): string => {
  if (node.type === 'Literal') return ctx.addParameter(node.value);
  if (node.type === 'Column') {
    return `${quoteIdentifier(node.table)}.${quoteIdentifier(node.name)}`;
  }
  throw new Error(`Unsupported test operand: ${node.type}`);
};

const compileExpression = (_node: ExpressionNode, _ctx: CompilerContext): string => {
  void _node;
  void _ctx;
  throw new Error('Expression compilation is not needed by this composition test');
};

describe('standard compiler composition', () => {
  it('assembles SELECT and DML compilers without SqlDialectBase', () => {
    let selectCompiler!: StandardSelectCompiler;

    const services: StandardSqlCompilerServices = {
      getDialectName: () => 'sqlite',
      getPaginationStrategy: () => new StandardLimitOffsetPagination(),
      getTableFunctionStrategy: () => new StandardTableFunctionStrategy(),
      quoteIdentifier,
      compileOperand,
      compileExpression,
      compileOrderingTerm: (term, ctx) => compileOperand(term as OperandNode, ctx),
      normalizeSelectAst: ast => ast,
      compileSelectAst: (ast, ctx) => selectCompiler.compile(ast, ctx),
      compileReturning: () => '',
      compileUpsertClause: () => '',
      compileSetTarget: column => quoteIdentifier(column.name),
      renderOrderByNulls: order => order.nulls ? ` NULLS ${order.nulls}` : '',
      renderOrderByCollation: order => order.collation ? ` COLLATE ${order.collation}` : ''
    };

    const sources = new StandardSqlSourceCompiler(services);
    selectCompiler = new StandardSelectCompiler(services, sources);
    const insertCompiler = new StandardInsertCompiler(services, sources);
    const updateCompiler = new StandardUpdateCompiler(services, sources);
    const deleteCompiler = new StandardDeleteCompiler(services, sources);

    const id = { type: 'Column', table: 'users', name: 'id' } as const;
    const name = { type: 'Column', table: 'users', name: 'name' } as const;
    const table = { type: 'Table', name: 'users' } as const;

    const select: SelectQueryNode = {
      type: 'SelectQuery',
      from: table,
      columns: [id, name],
      joins: []
    };
    expect(selectCompiler.compile(select, createContext()))
      .toBe('SELECT "users"."id", "users"."name" FROM "users"');

    const insertContext = createContext();
    const insert: InsertQueryNode = {
      type: 'InsertQuery',
      into: table,
      columns: [name],
      source: {
        type: 'InsertValues',
        rows: [[{ type: 'Literal', value: 'Ada' }]]
      }
    };
    expect(insertCompiler.compile(insert, insertContext))
      .toBe('INSERT INTO "users" ("name") VALUES (?)');
    expect(insertContext.params).toEqual(['Ada']);

    const updateContext = createContext();
    const update: UpdateQueryNode = {
      type: 'UpdateQuery',
      table,
      set: [{ column: name, value: { type: 'Literal', value: 'Grace' } }]
    };
    expect(updateCompiler.compile(update, updateContext))
      .toBe('UPDATE "users" SET "name" = ?');
    expect(updateContext.params).toEqual(['Grace']);

    const remove: DeleteQueryNode = {
      type: 'DeleteQuery',
      from: table
    };
    expect(deleteCompiler.compile(remove, createContext()))
      .toBe('DELETE FROM "users"');
  });
});
