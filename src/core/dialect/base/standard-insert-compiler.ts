import type { CompilerContext } from '../abstract.js';
import type { InsertQueryNode, InsertSourceNode, UpsertClause } from '../../ast/query.js';
import type { ColumnNode } from '../../ast/expression.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/** Standard INSERT orchestration, including VALUES/SELECT sources and upsert hook. */
export class StandardInsertCompiler {
  public constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.columns.length) {
      throw new Error('INSERT queries must specify columns.');
    }

    const table = this.sources.compileTableName(ast.into);
    const columnList = this.compileColumnList(ast.columns);
    const source = this.compileSource(ast.source, ctx);
    const upsert = this.services.compileUpsertClause(ast, ctx);
    const returning = this.services.compileReturning(ast.returning, ctx);
    return `INSERT INTO ${table} (${columnList}) ${source}${upsert}${returning}`;
  }

  compileSource(source: InsertSourceNode, ctx: CompilerContext): string {
    if (source.type === 'InsertValues') {
      if (!source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const values = source.rows
        .map(row => `(${row.map(value => this.services.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `VALUES ${values}`;
    }

    const normalized = this.services.normalizeSelectAst(source.query);
    return this.services.compileSelectAst(normalized, ctx).trim();
  }

  compileColumnList(columns: ColumnNode[]): string {
    return columns.map(column => this.services.quoteIdentifier(column.name)).join(', ');
  }

  ensureConflictColumns(clause: UpsertClause, message: string): void {
    if (!clause.target.columns.length) throw new Error(message);
  }
}
