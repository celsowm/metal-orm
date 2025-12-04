import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { ColumnNode } from '../ast/expression';
import { CompiledQuery, InsertCompiler } from '../dialect/abstract';
import { InsertQueryNode } from '../ast/query';
import { InsertQueryState } from './insert-query-state';
import { buildColumnNode } from '../ast/builders';

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

  compile(compiler: InsertCompiler): CompiledQuery {
    return compiler.compileInsert(this.state.ast);
  }

  toSql(compiler: InsertCompiler): string {
    return this.compile(compiler).sql;
  }

  getAST(): InsertQueryNode {
    return this.state.ast;
  }
}
