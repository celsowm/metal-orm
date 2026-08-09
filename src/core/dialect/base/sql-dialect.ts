import { DialectBase } from '../abstract.js';
import type { CompilerContext } from '../abstract.js';
import type {
  SelectQueryNode,
  InsertQueryNode,
  UpdateQueryNode,
  DeleteQueryNode,
  UpsertClause,
  TableSourceNode,
  DerivedTableNode,
  FunctionTableNode,
  OrderByNode,
  TableNode
} from '../../ast/query.js';
import type { ColumnNode, OperandNode } from '../../ast/expression.js';
import type { FunctionStrategy } from '../../functions/types.js';
import type { TableFunctionStrategy } from '../../functions/table-types.js';
import { StandardLimitOffsetPagination } from './pagination-strategy.js';
import type { PaginationStrategy } from './pagination-strategy.js';
import { NoReturningStrategy } from './returning-strategy.js';
import type { ReturningStrategy } from './returning-strategy.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import { StandardSelectCompiler } from './standard-select-compiler.js';
import { StandardInsertCompiler } from './standard-insert-compiler.js';
import { StandardUpdateCompiler } from './standard-update-compiler.js';
import { StandardDeleteCompiler } from './standard-delete-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/**
 * Thin assembly base for dialects that use MetalORM's standard SQL compilers.
 *
 * SELECT/INSERT/UPDATE/DELETE orchestration lives in independent compiler
 * objects. This class only wires dialect-specific syntax hooks and strategies
 * into those components.
 */
export abstract class SqlDialectBase extends DialectBase {
  abstract quoteIdentifier(id: string): string;

  protected paginationStrategy: PaginationStrategy = new StandardLimitOffsetPagination();
  protected returningStrategy: ReturningStrategy = new NoReturningStrategy();

  private readonly sourceCompiler: StandardSqlSourceCompiler;
  private readonly selectCompiler: StandardSelectCompiler;
  private readonly insertCompiler: StandardInsertCompiler;
  private readonly updateCompiler: StandardUpdateCompiler;
  private readonly deleteCompiler: StandardDeleteCompiler;

  protected constructor(
    functionStrategy?: FunctionStrategy,
    tableFunctionStrategy?: TableFunctionStrategy
  ) {
    super(functionStrategy, tableFunctionStrategy);

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
    this.selectCompiler = new StandardSelectCompiler(services, this.sourceCompiler);
    this.insertCompiler = new StandardInsertCompiler(services, this.sourceCompiler);
    this.updateCompiler = new StandardUpdateCompiler(services, this.sourceCompiler);
    this.deleteCompiler = new StandardDeleteCompiler(services, this.sourceCompiler);
  }

  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    return this.selectCompiler.compile(ast, ctx);
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    return this.insertCompiler.compile(ast, ctx);
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    return this.updateCompiler.compile(ast, ctx);
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    return this.deleteCompiler.compile(ast, ctx);
  }

  protected compileUpsertClause(ast: InsertQueryNode, _ctx: CompilerContext): string {
    void _ctx;
    if (!ast.onConflict) return '';
    throw new Error(`UPSERT/ON CONFLICT is not supported by dialect "${this.dialect}".`);
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    return this.returningStrategy.compileReturning(returning, ctx);
  }

  protected ensureConflictColumns(clause: UpsertClause, message: string): void {
    this.insertCompiler.ensureConflictColumns(clause, message);
  }

  protected compileUpdateAssignments(
    assignments: { column: ColumnNode; value: OperandNode }[],
    table: TableNode,
    ctx: CompilerContext
  ): string {
    return this.updateCompiler.compileAssignments(assignments, table, ctx);
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
