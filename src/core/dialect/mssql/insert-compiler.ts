import type { InsertQueryNode } from '../../ast/query.js';
import type { CompilerContext } from '../abstract.js';
import type { SqlAstCompiler } from '../base/sql-compiler-set.js';
import type { StandardSqlCompilerServices } from '../base/standard-sql-services.js';
import type { StandardSqlSourceCompiler } from '../base/standard-sql-source-compiler.js';

export class MssqlInsertCompiler implements SqlAstCompiler<InsertQueryNode> {
  constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.columns.length) {
      throw new Error('INSERT queries must specify columns.');
    }
    if (ast.onConflict) return this.compileMerge(ast, ctx);

    const table = this.sources.compileTableName(ast.into);
    const columns = ast.columns
      .map(column => this.services.quoteIdentifier(column.name))
      .join(', ');
    const output = this.services.compileReturning(ast.returning, ctx);
    const source = this.compileInsertSource(ast, ctx);
    return `INSERT INTO ${table} (${columns})${output} ${source}`;
  }

  private compileMerge(ast: InsertQueryNode, ctx: CompilerContext): string {
    const clause = ast.onConflict!;
    if (clause.target.constraint) {
      throw new Error('MSSQL MERGE does not support conflict target by constraint name.');
    }
    if (!clause.target.columns.length) {
      throw new Error('MSSQL MERGE requires conflict columns for the ON clause.');
    }

    const table = this.sources.compileTableName(ast.into);
    const targetRef = this.services.quoteIdentifier(ast.into.alias ?? ast.into.name);
    const sourceAlias = this.services.quoteIdentifier('src');
    const sourceColumns = ast.columns
      .map(column => this.services.quoteIdentifier(column.name))
      .join(', ');
    const usingSource = this.compileMergeUsingSource(ast, ctx);
    const onClause = clause.target.columns
      .map(column =>
        `${targetRef}.${this.services.quoteIdentifier(column.name)} = ${sourceAlias}.${this.services.quoteIdentifier(column.name)}`
      )
      .join(' AND ');

    const branches: string[] = [];
    if (clause.action.type === 'DoUpdate') {
      if (!clause.action.set.length) {
        throw new Error('MSSQL MERGE WHEN MATCHED UPDATE requires at least one assignment.');
      }
      const assignments = clause.action.set
        .map(assignment => {
          const target = `${targetRef}.${this.services.quoteIdentifier(assignment.column.name)}`;
          const value = this.services.compileOperand(assignment.value, ctx);
          return `${target} = ${value}`;
        })
        .join(', ');
      const guard = clause.action.where
        ? ` AND ${this.services.compileExpression(clause.action.where, ctx)}`
        : '';
      branches.push(`WHEN MATCHED${guard} THEN UPDATE SET ${assignments}`);
    }

    const insertColumns = ast.columns
      .map(column => this.services.quoteIdentifier(column.name))
      .join(', ');
    const insertValues = ast.columns
      .map(column => `${sourceAlias}.${this.services.quoteIdentifier(column.name)}`)
      .join(', ');
    branches.push(`WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})`);

    const output = this.services.compileReturning(ast.returning, ctx);
    return `MERGE INTO ${table} USING ${usingSource} AS ${sourceAlias} (${sourceColumns}) ON ${onClause} ${branches.join(' ')}${output}`;
  }

  private compileMergeUsingSource(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (ast.source.type === 'InsertValues') {
      if (!ast.source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const rows = ast.source.rows
        .map(row => `(${row.map(value => this.services.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `(VALUES ${rows})`;
    }

    const normalized = this.services.normalizeSelectAst(ast.source.query);
    const selectSql = this.sources.stripTrailingSemicolon(
      this.services.compileSelectAst(normalized, ctx)
    );
    return `(${selectSql})`;
  }

  private compileInsertSource(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (ast.source.type === 'InsertValues') {
      if (!ast.source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const values = ast.source.rows
        .map(row => `(${row.map(value => this.services.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `VALUES ${values}`;
    }

    const normalized = this.services.normalizeSelectAst(ast.source.query);
    return this.services.compileSelectAst(normalized, ctx).trim();
  }
}
