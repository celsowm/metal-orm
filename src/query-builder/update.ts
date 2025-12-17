import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import { JOIN_KINDS, JoinKind } from '../core/sql/sql.js';
import { CompiledQuery, Dialect } from '../core/dialect/abstract.js';
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

  /**
   * Creates a new UpdateQueryBuilder instance
   * @param table - The table definition for the UPDATE query
   * @param state - Optional initial query state, defaults to a new UpdateQueryState
   */
  constructor(table: TableDef, state?: UpdateQueryState) {
    this.table = table;
    this.state = state ?? new UpdateQueryState(table);
  }

  private clone(state: UpdateQueryState): UpdateQueryBuilder<T> {
    return new UpdateQueryBuilder(this.table, state);
  }

  /**
   * Sets an alias for the table in the UPDATE query
   * @param alias - The alias to assign to the table
   * @returns A new UpdateQueryBuilder with the table alias set
   */
  as(alias: string): UpdateQueryBuilder<T> {
    return this.clone(this.state.withTableAlias(alias));
  }

  /**
   * Adds a FROM clause to the UPDATE query
   * @param source - The table source to use in the FROM clause
   * @returns A new UpdateQueryBuilder with the FROM clause added
   */
  from(source: TableDef | TableSourceNode): UpdateQueryBuilder<T> {
    const tableSource = this.resolveTableSource(source);
    return this.clone(this.state.withFrom(tableSource));
  }

  /**
   * Adds a JOIN clause to the UPDATE query
   * @param table - The table to join with
   * @param condition - The join condition expression
   * @param kind - The type of join (defaults to INNER)
   * @param relationName - Optional name for the relation
   * @returns A new UpdateQueryBuilder with the JOIN clause added
   */
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

  /**
   * Adds a SET clause to the UPDATE query
   * @param values - The column-value pairs to update
   * @returns A new UpdateQueryBuilder with the SET clause added
   */
  set(values: Record<string, unknown>): UpdateQueryBuilder<T> {
    return this.clone(this.state.withSet(values));
  }

  /**
   * Adds a WHERE clause to the UPDATE query
   * @param expr - The expression to use as the WHERE condition
   * @returns A new UpdateQueryBuilder with the WHERE clause added
   */
  where(expr: ExpressionNode): UpdateQueryBuilder<T> {
    return this.clone(this.state.withWhere(expr));
  }

  /**
   * Adds a RETURNING clause to the UPDATE query
   * @param columns - Columns to return after update
   * @returns A new UpdateQueryBuilder with the RETURNING clause added
   */
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

  /**
   * Compiles the UPDATE query for the specified dialect
   * @param dialect - The SQL dialect to compile for
   * @returns The compiled query with SQL and parameters
   */
  compile(dialect: UpdateDialectInput): CompiledQuery {
    const resolved = resolveDialectInput(dialect);
    return resolved.compileUpdate(this.state.ast);
  }

  /**
   * Returns the SQL string for the UPDATE query
   * @param dialect - The SQL dialect to generate SQL for
   * @returns The SQL string representation of the query
   */
  toSql(dialect: UpdateDialectInput): string {
    return this.compile(dialect).sql;
  }

  /**
   * Executes the UPDATE query using the provided session
   * @param session - The ORM session to execute the query with
   * @returns A promise that resolves to the query results
   */
  async execute(session: OrmSession): Promise<QueryResult[]> {
    const compiled = this.compile(session.dialect);
    return session.executor.executeSql(compiled.sql, compiled.params);
  }

  /**
   * Returns the Abstract Syntax Tree (AST) representation of the query
   * @returns The AST node for the UPDATE query
   */
  getAST(): UpdateQueryNode {
    return this.state.ast;
  }
}

const isTableSourceNode = (source: TableDef | TableSourceNode): source is TableSourceNode =>
  typeof (source as TableSourceNode).type === 'string';

