import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
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

  /**
   * Creates a new DeleteQueryBuilder instance
   * @param table - The table definition for the DELETE query
   * @param state - Optional initial query state, defaults to a new DeleteQueryState
   */
  constructor(table: TableDef, state?: DeleteQueryState) {
    this.table = table;
    this.state = state ?? new DeleteQueryState(table);
  }

  private clone(state: DeleteQueryState): DeleteQueryBuilder<T> {
    return new DeleteQueryBuilder(this.table, state);
  }

  /**
   * Adds a WHERE clause to the DELETE query
   * @param expr - The expression to use as the WHERE condition
   * @returns A new DeleteQueryBuilder with the WHERE clause added
   */
  where(expr: ExpressionNode): DeleteQueryBuilder<T> {
    return this.clone(this.state.withWhere(expr));
  }

  /**
   * Sets an alias for the table in the DELETE query
   * @param alias - The alias to assign to the table
   * @returns A new DeleteQueryBuilder with the table alias set
   */
  as(alias: string): DeleteQueryBuilder<T> {
    return this.clone(this.state.withTableAlias(alias));
  }

  /**
   * Adds a USING clause to the DELETE query
   * @param source - The table source to use in the USING clause
   * @returns A new DeleteQueryBuilder with the USING clause added
   */
  using(source: TableDef | TableSourceNode): DeleteQueryBuilder<T> {
    return this.clone(this.state.withUsing(this.resolveTableSource(source)));
  }

  /**
   * Adds a JOIN clause to the DELETE query
   * @param table - The table to join with
   * @param condition - The join condition expression
   * @param kind - The type of join (defaults to INNER)
   * @param relationName - Optional name for the relation
   * @returns A new DeleteQueryBuilder with the JOIN clause added
   */
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

  /**
   * Adds a RETURNING clause to the DELETE query
   * @param columns - The columns to return after deletion
   * @returns A new DeleteQueryBuilder with the RETURNING clause added
   */
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

  /**
   * Compiles the DELETE query for the specified dialect
   * @param dialect - The SQL dialect to compile for
   * @returns The compiled query with SQL and parameters
   */
  compile(dialect: DeleteDialectInput): CompiledQuery {
    const resolved = resolveDialectInput(dialect);
    return resolved.compileDelete(this.state.ast);
  }

  /**
   * Returns the SQL string for the DELETE query
   * @param dialect - The SQL dialect to generate SQL for
   * @returns The SQL string representation of the query
   */
  toSql(dialect: DeleteDialectInput): string {
    return this.compile(dialect).sql;
  }

  /**
   * Executes the DELETE query using the provided session
   * @param session - The ORM session to execute the query with
   * @returns A promise that resolves to the query results
   */
  async execute(session: OrmSession): Promise<QueryResult[]> {
    const execCtx = session.getExecutionContext();
    const compiled = this.compile(execCtx.dialect);
    return execCtx.interceptors.run({ sql: compiled.sql, params: compiled.params }, execCtx.executor);
  }

  /**
   * Returns the Abstract Syntax Tree (AST) representation of the query
   * @returns The AST node for the DELETE query
   */
  getAST(): DeleteQueryNode {
    return this.state.ast;
  }
}

const isTableSourceNode = (source: TableDef | TableSourceNode): source is TableSourceNode =>
  typeof (source as TableSourceNode).type === 'string';

