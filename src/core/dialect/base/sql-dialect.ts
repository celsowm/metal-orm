import { DialectBase } from '../abstract.js';
import type { CompilerContext } from '../abstract.js';
import type {
  DeleteQueryNode,
  DerivedTableNode,
  FunctionTableNode,
  InsertQueryNode,
  OrderByNode,
  SelectQueryNode,
  TableNode,
  TableSourceNode,
  UpdateAssignmentNode,
  UpdateQueryNode,
  UpsertClause
} from '../../ast/query.js';
import type { ColumnNode, OperandNode } from '../../ast/expression.js';
import type { FunctionStrategy } from '../../functions/types.js';
import type { TableFunctionStrategy } from '../../functions/table-types.js';
import { StandardLimitOffsetPagination } from './pagination-strategy.js';
import type { PaginationStrategy } from './pagination-strategy.js';
import { NoReturningStrategy } from './returning-strategy.js';
import type { ReturningStrategy } from './returning-strategy.js';
import { NoUpsertStrategy } from './upsert-strategy.js';
import type { UpsertStrategy } from './upsert-strategy.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import { StandardSelectCompiler } from './standard-select-compiler.js';
import { StandardInsertCompiler } from './standard-insert-compiler.js';
import { StandardUpdateCompiler } from './standard-update-compiler.js';
import { StandardDeleteCompiler } from './standard-delete-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';
import type { SqlCompilerFactory, SqlCompilerSet } from './sql-compiler-set.js';

export interface SqlDialectBaseOptions {
  functionStrategy?: FunctionStrategy;
  tableFunctionStrategy?: TableFunctionStrategy;
  paginationStrategy?: PaginationStrategy;
  returningStrategy?: ReturningStrategy;
  upsertStrategy?: UpsertStrategy;
  compilerFactory?: SqlCompilerFactory;
  supportsDmlReturning?: boolean;
}

/**
 * Thin assembly base for dialects that use MetalORM's reusable SQL compiler pieces.
 *
 * Query orchestration, source rendering, upsert behavior and returning behavior are
 * injected components. Concrete dialects keep only syntax hooks that are genuinely
 * intrinsic to that backend.
 */
export abstract class SqlDialectBase extends DialectBase {
  abstract quoteIdentifier(id: string): string;

  protected readonly paginationStrategy: PaginationStrategy;
  protected readonly returningStrategy: ReturningStrategy;
  protected readonly upsertStrategy: UpsertStrategy;

  private readonly dmlReturningSupported: boolean;
  private readonly sourceCompiler: StandardSqlSourceCompiler;
  private readonly standardUpdateCompiler: StandardUpdateCompiler;
  private readonly compilerSet: SqlCompilerSet;

  protected constructor(options: SqlDialectBaseOptions = {}) {
    super(options.functionStrategy, options.tableFunctionStrategy);

    this.paginationStrategy = options.paginationStrategy ?? new StandardLimitOffsetPagination();
    this.returningStrategy = options.returningStrategy ?? new NoReturningStrategy();
    this.upsertStrategy = options.upsertStrategy ?? new NoUpsertStrategy();
    this.dmlReturningSupported = options.supportsDmlReturning ?? false;

    const services: StandardSqlCompilerServices = {
      getDialectName: () => this.dialect,
      getPaginationStrategy: () => this.paginationStrategy,
      getTableFunctionStrategy: () => this.tableFunctionStrategy,
      quoteIdentifier: id => this.quoteIdentifier(id),
      compileOperand: (node, ctx) => this.compileOperand(node, ctx),
      compileExpression: (node, ctx) => this.compileExpression(node, ctx),
      compileOrderingTerm: (term, ctx) => this.compileOrderingTerm(term, ctx),
      normalizeSelectAst: ast => this.normalizeSelectAst(ast),
      compileSelectAst: (ast, ctx) => this.compileSelectAst(ast, ctx),
      compileReturning: (returning, ctx) => this.compileReturning(returning, ctx),
      compileUpsertClause: (ast, ctx) => this.compileUpsertClause(ast, ctx),
      compileSetTarget: (column, table) => this.compileSetTarget(column, table),
      renderOrderByNulls: order => this.renderOrderByNulls(order),
      renderOrderByCollation: order => this.renderOrderByCollation(order)
    };

    this.sourceCompiler = new StandardSqlSourceCompiler(services);
    const standardSelect = new StandardSelectCompiler(services, this.sourceCompiler);
    const standardInsert = new StandardInsertCompiler(services, this.sourceCompiler);
    this.standardUpdateCompiler = new StandardUpdateCompiler(services, this.sourceCompiler);
    const standardDelete = new StandardDeleteCompiler(services, this.sourceCompiler);

    const overrides = options.compilerFactory?.({
      services,
      sources: this.sourceCompiler
    }) ?? {};

    this.compilerSet = {
      select: overrides.select ?? standardSelect,
      insert: overrides.insert ?? standardInsert,
      update: overrides.update ?? this.standardUpdateCompiler,
      delete: overrides.delete ?? standardDelete
    };
  }

  override supportsDmlReturningClause(): boolean {
    return this.dmlReturningSupported;
  }

  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    return this.compilerSet.select.compile(ast, ctx);
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    return this.compilerSet.insert.compile(ast, ctx);
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    return this.compilerSet.update.compile(ast, ctx);
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    return this.compilerSet.delete.compile(ast, ctx);
  }

  protected compileUpsertClause(ast: InsertQueryNode, ctx: CompilerContext): string {
    return this.upsertStrategy.compile(ast, ctx, {
      getDialectName: () => this.dialect,
      quoteIdentifier: id => this.quoteIdentifier(id),
      compileOperand: (node, compilerContext) => this.compileOperand(node, compilerContext),
      compileExpression: (node, compilerContext) => this.compileExpression(node, compilerContext),
      compileUpdateAssignments: (assignments, table, compilerContext) =>
        this.standardUpdateCompiler.compileAssignments(assignments, table, compilerContext)
    });
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    return this.returningStrategy.compileReturning(
      returning,
      ctx,
      id => this.quoteIdentifier(id)
    );
  }

  protected ensureConflictColumns(clause: UpsertClause, message: string): void {
    if (!clause.target.columns.length) throw new Error(message);
  }

  protected compileUpdateAssignments(
    assignments: UpdateAssignmentNode[],
    table: TableNode,
    ctx: CompilerContext
  ): string {
    return this.standardUpdateCompiler.compileAssignments(assignments, table, ctx);
  }

  protected compileSetTarget(column: ColumnNode, table: TableNode): string {
    return this.compileQualifiedColumn(column, table);
  }

  protected compileQualifiedColumn(column: ColumnNode, table: TableNode): string {
    const baseTableName = table.name;
    const alias = table.alias;
    const columnTable = column.table ?? alias ?? baseTableName;
    const tableQualifier = alias && column.table === baseTableName ? alias : columnTable;

    if (!tableQualifier) return this.quoteIdentifier(column.name);
    return `${this.quoteIdentifier(tableQualifier)}.${this.quoteIdentifier(column.name)}`;
  }

  protected formatReturningColumns(returning: ColumnNode[]): string {
    return this.returningStrategy.formatReturningColumns(
      returning,
      id => this.quoteIdentifier(id)
    );
  }

  protected compileFrom(source: TableSourceNode, ctx?: CompilerContext): string {
    return this.sourceCompiler.compileFrom(source, ctx);
  }

  protected compileFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    return this.sourceCompiler.compileFunctionTable(fn, ctx);
  }

  protected compileDerivedTable(table: DerivedTableNode, ctx?: CompilerContext): string {
    return this.sourceCompiler.compileDerivedTable(table, ctx);
  }

  protected compileTableSource(table: TableSourceNode): string {
    return this.sourceCompiler.compileTableSource(table);
  }

  protected compileTableName(table: { name: string; schema?: string }): string {
    return this.sourceCompiler.compileTableName(table);
  }

  protected compileTableReference(table: { name: string; schema?: string; alias?: string }): string {
    return this.sourceCompiler.compileTableReference(table);
  }

  protected stripTrailingSemicolon(sql: string): string {
    return this.sourceCompiler.stripTrailingSemicolon(sql);
  }

  protected wrapSetOperand(sql: string): string {
    return this.sourceCompiler.wrapSetOperand(sql);
  }

  protected renderOrderByNulls(order: OrderByNode): string | undefined {
    return order.nulls ? ` NULLS ${order.nulls}` : '';
  }

  protected renderOrderByCollation(order: OrderByNode): string | undefined {
    return order.collation ? ` COLLATE ${order.collation}` : '';
  }
}
