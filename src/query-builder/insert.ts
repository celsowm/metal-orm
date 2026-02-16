import type { SelectQueryBuilder } from './select.js';
import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import {
  ColumnNode,
  ExpressionNode,
  isValueOperandInput,
  valueToOperand
} from '../core/ast/expression.js';
import type { ValueOperandInput } from '../core/ast/expression.js';
import { CompiledQuery, InsertCompiler, Dialect } from '../core/dialect/abstract.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import {
  InsertQueryNode,
  SelectQueryNode,
  UpsertClause,
  UpdateAssignmentNode
} from '../core/ast/query.js';
import { InsertQueryState } from './insert-query-state.js';
import { buildColumnNode } from '../core/ast/builders.js';

type InsertDialectInput = Dialect | DialectKey;

/**
 * Builder returned by InsertQueryBuilder.onConflict()
 */
export class ConflictBuilder<T> {
  private readonly table: TableDef;
  private readonly columns: ColumnNode[];
  private readonly constraint?: string;
  private readonly applyClause: (clause: UpsertClause) => InsertQueryBuilder<T>;

  constructor(
    table: TableDef,
    columns: ColumnNode[],
    constraint: string | undefined,
    applyClause: (clause: UpsertClause) => InsertQueryBuilder<T>
  ) {
    this.table = table;
    this.columns = columns;
    this.constraint = constraint;
    this.applyClause = applyClause;
  }

  /**
   * Adds ON CONFLICT ... DO UPDATE
   * @param set - Column assignments for update branch
   * @param where - Optional filter for update branch
   * @returns InsertQueryBuilder with the upsert clause configured
   */
  doUpdate(
    set: Record<string, ValueOperandInput>,
    where?: ExpressionNode
  ): InsertQueryBuilder<T> {
    const assignments = this.buildAssignments(set);
    return this.applyClause({
      target: this.buildTarget(),
      action: {
        type: 'DoUpdate',
        set: assignments,
        where
      }
    });
  }

  /**
   * Adds ON CONFLICT ... DO NOTHING
   * @returns InsertQueryBuilder with the upsert clause configured
   */
  doNothing(): InsertQueryBuilder<T> {
    return this.applyClause({
      target: this.buildTarget(),
      action: { type: 'DoNothing' }
    });
  }

  private buildTarget(): UpsertClause['target'] {
    return {
      columns: [...this.columns],
      constraint: this.constraint
    };
  }

  private buildAssignments(set: Record<string, ValueOperandInput>): UpdateAssignmentNode[] {
    const entries = Object.entries(set);
    if (!entries.length) {
      throw new Error('ON CONFLICT DO UPDATE requires at least one assignment.');
    }

    return entries.map(([columnName, rawValue]) => {
      if (!isValueOperandInput(rawValue)) {
        throw new Error(
          `Invalid upsert value for column "${columnName}": only string, number, boolean, Date, Buffer, null, or OperandNodes are allowed`
        );
      }

      return {
        column: buildColumnNode(this.table, { name: columnName, table: this.table.name }),
        value: valueToOperand(rawValue)
      };
    });
  }
}

/**
 * Builder for INSERT queries
 */
export class InsertQueryBuilder<T> {
  private readonly table: TableDef;
  private readonly state: InsertQueryState;

  /**
   * Creates a new InsertQueryBuilder instance
   * @param table - The table definition for the INSERT query
   * @param state - Optional initial query state, defaults to a new InsertQueryState
   */
  constructor(table: TableDef, state?: InsertQueryState) {
    this.table = table;
    this.state = state ?? new InsertQueryState(table);
  }

  private clone(state: InsertQueryState): InsertQueryBuilder<T> {
    return new InsertQueryBuilder(this.table, state);
  }

  private withOnConflict(clause: UpsertClause): InsertQueryBuilder<T> {
    return this.clone(this.state.withOnConflict(clause));
  }

  /**
   * Adds VALUES to the INSERT query
   * @param rowOrRows - Single row object or array of row objects to insert
   * @returns A new InsertQueryBuilder with the VALUES clause added
   */
  values(
    rowOrRows: Record<string, ValueOperandInput> | Record<string, ValueOperandInput>[]
  ): InsertQueryBuilder<T> {
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    if (!rows.length) return this;
    return this.clone(this.state.withValues(rows));
  }

  /**
   * Specifies the columns for the INSERT query
   * @param columns - Column definitions or nodes to insert into
   * @returns A new InsertQueryBuilder with the specified columns
   */
  columns(...columns: (ColumnDef | ColumnNode)[]): InsertQueryBuilder<T> {
    if (!columns.length) return this;
    return this.clone(this.state.withColumns(this.resolveColumnNodes(columns)));
  }

  /**
   * Sets the source of the INSERT query to a SELECT query
   * @template TSource - The source table type
   * @param query - The SELECT query or query builder to use as source
   * @param columns - Optional target columns for the INSERT
   * @returns A new InsertQueryBuilder with the SELECT source
   */
  fromSelect<TSource extends TableDef>(
    query: SelectQueryNode | SelectQueryBuilder<unknown, TSource>,
    columns: (ColumnDef | ColumnNode)[] = []
  ): InsertQueryBuilder<T> {
    const ast = this.resolveSelectQuery(query);
    const nodes = columns.length ? this.resolveColumnNodes(columns) : [];
    return this.clone(this.state.withSelect(ast, nodes));
  }

  /**
   * Configures UPSERT conflict handling for INSERT.
   * @param columns - Conflict target columns (ignored by MySQL)
   * @param constraint - Named unique/primary constraint (PostgreSQL only)
   * @returns ConflictBuilder for selecting action (DO UPDATE / DO NOTHING)
   */
  onConflict(
    columns: (ColumnDef | ColumnNode)[] = [],
    constraint?: string
  ): ConflictBuilder<T> {
    const resolvedColumns = columns.length ? this.resolveColumnNodes(columns) : [];
    return new ConflictBuilder(
      this.table,
      resolvedColumns,
      constraint,
      clause => this.withOnConflict(clause)
    );
  }

  /**
   * Adds a RETURNING clause to the INSERT query
   * @param columns - Columns to return after insertion
   * @returns A new InsertQueryBuilder with the RETURNING clause added
   */
  returning(...columns: (ColumnDef | ColumnNode)[]): InsertQueryBuilder<T> {
    if (!columns.length) return this;
    const nodes = columns.map(column => buildColumnNode(this.table, column));
    return this.clone(this.state.withReturning(nodes));
  }

  // Helpers for column/AST resolution
  private resolveColumnNodes(columns: (ColumnDef | ColumnNode)[]): ColumnNode[] {
    return columns.map(column => buildColumnNode(this.table, column));
  }

  private resolveSelectQuery<TSource extends TableDef>(
    query: SelectQueryNode | SelectQueryBuilder<unknown, TSource>
  ): SelectQueryNode {
    const candidate = query as { getAST?: () => SelectQueryNode };
    return typeof candidate.getAST === 'function' && candidate.getAST
      ? candidate.getAST()
      : (query as SelectQueryNode);
  }

  // Existing compiler-based compile stays, but we add a new overload.

  /**
   * Compiles the INSERT query
   * @param compiler - The INSERT compiler to use
   * @returns The compiled query with SQL and parameters
   */
  compile(compiler: InsertCompiler): CompiledQuery;
  /**
   * Compiles the INSERT query for the specified dialect
   * @param dialect - The SQL dialect to compile for
   * @returns The compiled query with SQL and parameters
   */
  compile(dialect: InsertDialectInput): CompiledQuery;

  compile(arg: InsertCompiler | InsertDialectInput): CompiledQuery {
    const candidate = arg as { compileInsert?: (ast: InsertQueryNode) => CompiledQuery };
    if (typeof candidate.compileInsert === 'function') {
      // InsertCompiler path – old behavior
      return candidate.compileInsert(this.state.ast);
    }

    // Dialect | string path – new behavior
    const dialect = resolveDialectInput(arg as InsertDialectInput);
    return dialect.compileInsert(this.state.ast);
  }

  /**
   * Returns the SQL string for the INSERT query
   * @param arg - The compiler or dialect to generate SQL for
   * @returns The SQL string representation of the query
   */
  toSql(arg: InsertCompiler | InsertDialectInput): string {
    return this.compile(arg as InsertCompiler).sql;
  }

  /**
   * Returns the Abstract Syntax Tree (AST) representation of the query
   * @returns The AST node for the INSERT query
   */
  getAST(): InsertQueryNode {
    return this.state.ast;
  }
}

