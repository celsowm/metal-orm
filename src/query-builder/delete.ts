import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import { CompiledQuery, DeleteCompiler, Dialect } from '../core/dialect/abstract.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import { DeleteQueryNode } from '../core/ast/query.js';
import { DeleteQueryState } from './delete-query-state.js';
import { buildColumnNode } from '../core/ast/builders.js';

type DeleteDialectInput = Dialect | DialectKey;

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

  // Existing compiler-based compile stays, but we add a new overload.

  // 1) Keep the old behavior (used internally / tests, if any):
  compile(compiler: DeleteCompiler): CompiledQuery;
  // 2) New ergonomic overload:
  compile(dialect: DeleteDialectInput): CompiledQuery;

  compile(arg: DeleteCompiler | DeleteDialectInput): CompiledQuery {
    if (typeof (arg as any).compileDelete === 'function') {
      // DeleteCompiler path – old behavior
      return (arg as DeleteCompiler).compileDelete(this.state.ast);
    }

    // Dialect | string path – new behavior
    const dialect = resolveDialectInput(arg as DeleteDialectInput);
    return dialect.compileDelete(this.state.ast);
  }

  toSql(arg: DeleteCompiler | DeleteDialectInput): string {
    return this.compile(arg as any).sql;
  }

  getAST(): DeleteQueryNode {
    return this.state.ast;
  }
}
