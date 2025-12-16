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
import { OrmSession } from '../orm/orm-session.js';
import { QueryResult } from '../core/execution/db-executor.js';

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

  compile(dialect: UpdateDialectInput): CompiledQuery {
    const resolved = resolveDialectInput(dialect);
    return resolved.compileUpdate(this.state.ast);
  }

  toSql(dialect: UpdateDialectInput): string {
    return this.compile(dialect).sql;
  }

  async execute(session: OrmSession): Promise<QueryResult[]> {
    const compiled = this.compile(session.dialect);
    return session.executor.executeSql(compiled.sql, compiled.params);
  }

  getAST(): UpdateQueryNode {
    return this.state.ast;
  }
}

const isTableSourceNode = (source: TableDef | TableSourceNode): source is TableSourceNode =>
  typeof (source as TableSourceNode).type === 'string';
