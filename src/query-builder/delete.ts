import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import { JOIN_KINDS, JoinKind } from '../core/sql/sql.js';
import { CompiledQuery, Dialect } from '../core/dialect/abstract.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import { TableSourceNode, DeleteQueryNode } from '../core/ast/query.js';
import { DeleteQueryState } from './delete-query-state.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { buildColumnNode } from '../core/ast/builders.js';
import { OrmSession } from '../orm/orm-session.js';
import { QueryResult } from '../core/execution/db-executor.js';

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

  as(alias: string): DeleteQueryBuilder<T> {
    return this.clone(this.state.withTableAlias(alias));
  }

  using(source: TableDef | TableSourceNode): DeleteQueryBuilder<T> {
    return this.clone(this.state.withUsing(this.resolveTableSource(source)));
  }

  join(
    table: TableDef | TableSourceNode | string,
    condition: ExpressionNode,
    kind: JoinKind = JOIN_KINDS.INNER,
    relationName?: string
  ): DeleteQueryBuilder<T> {
    const target = this.resolveJoinTarget(table);
    const joinNode = createJoinNode(kind, target, condition, relationName);
    return this.clone(this.state.withJoin(joinNode));
  }

  returning(...columns: (ColumnDef | ColumnNode)[]): DeleteQueryBuilder<T> {
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

  compile(dialect: DeleteDialectInput): CompiledQuery {
    const resolved = resolveDialectInput(dialect);
    return resolved.compileDelete(this.state.ast);
  }

  toSql(dialect: DeleteDialectInput): string {
    return this.compile(dialect).sql;
  }

  async execute(session: OrmSession): Promise<QueryResult[]> {
    const compiled = this.compile(session.dialect);
    return session.executor.executeSql(compiled.sql, compiled.params);
  }

  getAST(): DeleteQueryNode {
    return this.state.ast;
  }
}

const isTableSourceNode = (source: TableDef | TableSourceNode): source is TableSourceNode =>
  typeof (source as TableSourceNode).type === 'string';
