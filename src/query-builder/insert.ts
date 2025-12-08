import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { ColumnNode } from '../core/ast/expression.js';
import { CompiledQuery, InsertCompiler, Dialect } from '../core/dialect/abstract.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import { InsertQueryNode } from '../core/ast/query.js';
import { InsertQueryState } from './insert-query-state.js';
import { buildColumnNode } from '../core/ast/builders.js';

type InsertDialectInput = Dialect | DialectKey;

/**
 * Builder for INSERT queries
 */
export class InsertQueryBuilder<T> {
  private readonly table: TableDef;
  private readonly state: InsertQueryState;

  constructor(table: TableDef, state?: InsertQueryState) {
    this.table = table;
    this.state = state ?? new InsertQueryState(table);
  }

  private clone(state: InsertQueryState): InsertQueryBuilder<T> {
    return new InsertQueryBuilder(this.table, state);
  }

  values(rowOrRows: Record<string, unknown> | Record<string, unknown>[]): InsertQueryBuilder<T> {
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    if (!rows.length) return this;
    return this.clone(this.state.withValues(rows));
  }

  returning(...columns: (ColumnDef | ColumnNode)[]): InsertQueryBuilder<T> {
    if (!columns.length) return this;
    const nodes = columns.map(column => buildColumnNode(this.table, column));
    return this.clone(this.state.withReturning(nodes));
  }

  // Existing compiler-based compile stays, but we add a new overload.

  // 1) Keep the old behavior (used internally / tests, if any):
  compile(compiler: InsertCompiler): CompiledQuery;
  // 2) New ergonomic overload:
  compile(dialect: InsertDialectInput): CompiledQuery;

  compile(arg: InsertCompiler | InsertDialectInput): CompiledQuery {
    if (typeof (arg as any).compileInsert === 'function') {
      // InsertCompiler path – old behavior
      return (arg as InsertCompiler).compileInsert(this.state.ast);
    }

    // Dialect | string path – new behavior
    const dialect = resolveDialectInput(arg as InsertDialectInput);
    return dialect.compileInsert(this.state.ast);
  }

  toSql(arg: InsertCompiler | InsertDialectInput): string {
    return this.compile(arg as any).sql;
  }

  getAST(): InsertQueryNode {
    return this.state.ast;
  }
}
