import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { ColumnNode, ExpressionNode } from '../ast/expression';
import { CompiledQuery, DeleteCompiler } from '../dialect/abstract';
import { DeleteQueryNode } from '../ast/query';
import { DeleteQueryState } from './delete-query-state';
import { buildColumnNode } from '../ast/builders';

/**
 * Builder for DELETE queries
 */
export class DeleteQueryBuilder<T> {
  private readonly table: TableDef;
  private readonly state: DeleteQueryState;

  constructor(table: TableDef, state?: DeleteQueryState) {
    this.table = table;
    this.state = state ?? new DeleteQueryState(table);
  }

  private clone(state: DeleteQueryState): DeleteQueryBuilder<T> {
    return new DeleteQueryBuilder(this.table, state);
  }

  where(expr: ExpressionNode): DeleteQueryBuilder<T> {
    return this.clone(this.state.withWhere(expr));
  }

  returning(...columns: (ColumnDef | ColumnNode)[]): DeleteQueryBuilder<T> {
    if (!columns.length) return this;
    const nodes = columns.map(column => buildColumnNode(this.table, column));
    return this.clone(this.state.withReturning(nodes));
  }

  compile(compiler: DeleteCompiler): CompiledQuery {
    return compiler.compileDelete(this.state.ast);
  }

  toSql(compiler: DeleteCompiler): string {
    return this.compile(compiler).sql;
  }

  getAST(): DeleteQueryNode {
    return this.state.ast;
  }
}
