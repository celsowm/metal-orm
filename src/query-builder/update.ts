import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { ColumnNode, ExpressionNode } from '../core/ast/expression';
import { CompiledQuery, UpdateCompiler } from '../core/dialect/abstract';
import { UpdateQueryNode } from '../core/ast/query';
import { UpdateQueryState } from './update-query-state';
import { buildColumnNode } from '../core/ast/builders';

/**
 * Builder for UPDATE queries
 */
export class UpdateQueryBuilder<T> {
  private readonly table: TableDef;
  private readonly state: UpdateQueryState;

  constructor(table: TableDef, state?: UpdateQueryState) {
    this.table = table;
    this.state = state ?? new UpdateQueryState(table);
  }

  private clone(state: UpdateQueryState): UpdateQueryBuilder<T> {
    return new UpdateQueryBuilder(this.table, state);
  }

  set(values: Record<string, unknown>): UpdateQueryBuilder<T> {
    return this.clone(this.state.withSet(values));
  }

  where(expr: ExpressionNode): UpdateQueryBuilder<T> {
    return this.clone(this.state.withWhere(expr));
  }

  returning(...columns: (ColumnDef | ColumnNode)[]): UpdateQueryBuilder<T> {
    if (!columns.length) return this;
    const nodes = columns.map(column => buildColumnNode(this.table, column));
    return this.clone(this.state.withReturning(nodes));
  }

  compile(compiler: UpdateCompiler): CompiledQuery {
    return compiler.compileUpdate(this.state.ast);
  }

  toSql(compiler: UpdateCompiler): string {
    return this.compile(compiler).sql;
  }

  getAST(): UpdateQueryNode {
    return this.state.ast;
  }
}
