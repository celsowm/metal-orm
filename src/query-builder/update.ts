import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import { JOIN_KINDS, JoinKind } from '../core/sql/sql.js';
import { CompiledQuery, UpdateCompiler, Dialect } from '../core/dialect/abstract.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import { TableSourceNode, UpdateQueryNode } from '../core/ast/query.js';
import { UpdateQueryState } from './update-query-state.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { buildColumnNode } from '../core/ast/builders.js';

type UpdateDialectInput = Dialect | DialectKey;

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

  as(alias: string): UpdateQueryBuilder<T> {
    return this.clone(this.state.withTableAlias(alias));
  }

  from(source: TableDef | TableSourceNode): UpdateQueryBuilder<T> {
    const tableSource = this.resolveTableSource(source);
    return this.clone(this.state.withFrom(tableSource));
  }

  join(
    table: TableDef | TableSourceNode | string,
    condition: ExpressionNode,
    kind: JoinKind = JOIN_KINDS.INNER,
    relationName?: string
  ): UpdateQueryBuilder<T> {
    const joinTarget = this.resolveJoinTarget(table);
    const joinNode = createJoinNode(kind, joinTarget, condition, relationName);
    return this.clone(this.state.withJoin(joinNode));
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

  private resolveTableSource(source: TableDef | TableSourceNode): TableSourceNode {
    if (isTableSourceNode(source)) {
      return source;
    }
    return { type: 'Table', name: source.name, schema: source.schema };
  }

  private resolveJoinTarget(table: TableDef | TableSourceNode | string): TableSourceNode | string {
    if (typeof table === 'string') return table;
    return this.resolveTableSource(table);
  }

  // Existing compiler-based compile stays, but we add a new overload.

  // 1) Keep the old behavior (used internally / tests, if any):
  compile(compiler: UpdateCompiler): CompiledQuery;
  // 2) New ergonomic overload:
  compile(dialect: UpdateDialectInput): CompiledQuery;

  compile(arg: UpdateCompiler | UpdateDialectInput): CompiledQuery {
    const candidate = arg as { compileUpdate?: (ast: UpdateQueryNode) => CompiledQuery };
    if (typeof candidate.compileUpdate === 'function') {
      // UpdateCompiler path – old behavior
      return candidate.compileUpdate(this.state.ast);
    }

    // Dialect | string path – new behavior
    const dialect = resolveDialectInput(arg as UpdateDialectInput);
    return dialect.compileUpdate(this.state.ast);
  }

  toSql(arg: UpdateCompiler | UpdateDialectInput): string {
    return this.compile(arg as UpdateCompiler).sql;
  }

  getAST(): UpdateQueryNode {
    return this.state.ast;
  }
}

const isTableSourceNode = (source: TableDef | TableSourceNode): source is TableSourceNode =>
  typeof (source as TableSourceNode).type === 'string';
