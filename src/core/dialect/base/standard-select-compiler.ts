import type { CompilerContext } from '../abstract.js';
import type { SelectQueryNode } from '../../ast/query.js';
import { CteCompiler } from './cte-compiler.js';
import { JoinCompiler } from './join-compiler.js';
import { GroupByCompiler } from './groupby-compiler.js';
import { OrderByCompiler } from './orderby-compiler.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/** Standard SELECT orchestration, independent from any dialect class hierarchy. */
export class StandardSelectCompiler {
  public constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = CteCompiler.compileCtes(
      ast,
      ctx,
      id => this.services.quoteIdentifier(id),
      (query, compilerContext) => this.services.compileSelectAst(query, compilerContext),
      query => this.services.normalizeSelectAst(query),
      sql => this.sources.stripTrailingSemicolon(sql)
    );

    const baseAst: SelectQueryNode = hasSetOps
      ? { ...ast, setOps: undefined, orderBy: undefined, limit: undefined, offset: undefined }
      : ast;
    const baseSelect = this.compileCore(baseAst, ctx);

    if (!hasSetOps) return `${ctes}${baseSelect}`;

    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.sources.wrapSetOperand(this.services.compileSelectAst(op.query, ctx))}`)
      .join(' ');
    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.services.getPaginationStrategy().compilePagination(ast.limit, ast.offset);
    const combined = `${this.sources.wrapSetOperand(baseSelect)} ${compound}`;
    return `${ctes}${combined}${orderBy}${pagination}`;
  }

  private compileCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = this.compileColumns(ast, ctx);
    const from = this.sources.compileFrom(ast.from, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      (source, compilerContext) => this.sources.compileFrom(source, compilerContext),
      (expression, compilerContext) => this.services.compileExpression(expression, compilerContext)
    );
    const where = ast.where ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}` : '';
    const groupBy = GroupByCompiler.compileGroupBy(
      ast,
      term => this.services.compileOrderingTerm(term, ctx)
    );
    const having = ast.having ? ` HAVING ${this.services.compileExpression(ast.having, ctx)}` : '';
    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.services.getPaginationStrategy().compilePagination(ast.limit, ast.offset);
    return `SELECT ${ast.distinct ? 'DISTINCT ' : ''}${columns} FROM ${from}${joins}${where}${groupBy}${having}${orderBy}${pagination}`;
  }

  private compileColumns(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.columns || ast.columns.length === 0) return '*';
    return ast.columns.map(column => {
      const expr = this.services.compileOperand(column, ctx);
      if (!column.alias) return expr;
      if (column.alias.includes('(')) return column.alias;
      return `${expr} AS ${this.services.quoteIdentifier(column.alias)}`;
    }).join(', ');
  }

  private compileOrderBy(ast: SelectQueryNode, ctx: CompilerContext): string {
    return OrderByCompiler.compileOrderBy(
      ast,
      term => this.services.compileOrderingTerm(term, ctx),
      order => this.services.renderOrderByNulls(order),
      order => this.services.renderOrderByCollation(order)
    );
  }
}
