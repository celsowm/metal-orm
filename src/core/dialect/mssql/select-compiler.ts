import type { OperandNode } from '../../ast/expression.js';
import type { SelectQueryNode } from '../../ast/query.js';
import type { CompilerContext } from '../abstract.js';
import { OrderByCompiler } from '../base/orderby-compiler.js';
import type { SqlAstCompiler } from '../base/sql-compiler-set.js';
import type { StandardSqlCompilerServices } from '../base/standard-sql-services.js';
import type { StandardSqlSourceCompiler } from '../base/standard-sql-source-compiler.js';

export class MssqlSelectCompiler implements SqlAstCompiler<SelectQueryNode> {
  constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = this.compileCtes(ast, ctx);
    const baseAst: SelectQueryNode = hasSetOps
      ? { ...ast, setOps: undefined, orderBy: undefined, limit: undefined, offset: undefined }
      : ast;
    const baseSelect = this.compileCore(baseAst, ctx);

    if (!hasSetOps) return `${ctes}${baseSelect}`;

    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.sources.wrapSetOperand(this.services.compileSelectAst(op.query, ctx))}`)
      .join(' ');
    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);
    const combined = `${this.sources.wrapSetOperand(baseSelect)} ${compound}`;
    return `${ctes}${combined}${pagination || orderBy}`;
  }

  private compileCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = ast.columns
      .map(column => {
        const expr = column.type === 'Column'
          ? `${this.services.quoteIdentifier(column.table)}.${this.services.quoteIdentifier(column.name)}`
          : this.services.compileOperand(column as OperandNode, ctx);
        if (!column.alias) return expr;
        if (column.alias.includes('(')) return column.alias;
        return `${expr} AS ${this.services.quoteIdentifier(column.alias)}`;
      })
      .join(', ');

    const distinct = ast.distinct ? 'DISTINCT ' : '';
    const from = this.sources.compileFrom(ast.from, ctx);
    const joins = ast.joins
      .map(join => {
        const table = this.sources.compileFrom(join.table, ctx);
        const condition = this.services.compileExpression(join.condition, ctx);
        return `${join.kind} JOIN ${table} ON ${condition}`;
      })
      .join(' ');
    const where = ast.where
      ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}`
      : '';
    const groupBy = ast.groupBy && ast.groupBy.length > 0
      ? ` GROUP BY ${ast.groupBy.map(term => this.services.compileOrderingTerm(term, ctx)).join(', ')}`
      : '';
    const having = ast.having
      ? ` HAVING ${this.services.compileExpression(ast.having, ctx)}`
      : '';
    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);

    if (pagination) {
      return `SELECT ${distinct}${columns} FROM ${from}${joins ? ` ${joins}` : ''}${where}${groupBy}${having}${pagination}`;
    }
    return `SELECT ${distinct}${columns} FROM ${from}${joins ? ` ${joins}` : ''}${where}${groupBy}${having}${orderBy}`;
  }

  private compileOrderBy(ast: SelectQueryNode, ctx: CompilerContext): string {
    return OrderByCompiler.compileOrderBy(
      ast,
      term => this.services.compileOrderingTerm(term, ctx),
      order => this.services.renderOrderByNulls(order),
      order => this.services.renderOrderByCollation(order)
    );
  }

  private compilePagination(ast: SelectQueryNode, orderBy: string): string {
    const hasLimit = ast.limit !== undefined;
    const hasOffset = ast.offset !== undefined;
    if (!hasLimit && !hasOffset) return '';

    const offset = ast.offset ?? 0;
    let orderClause = orderBy;
    if (!orderClause) {
      orderClause = ast.distinct && ast.distinct.length > 0
        ? ' ORDER BY 1'
        : ' ORDER BY (SELECT NULL)';
    }

    let pagination = `${orderClause} OFFSET ${offset} ROWS`;
    if (hasLimit) pagination += ` FETCH NEXT ${ast.limit} ROWS ONLY`;
    return pagination;
  }

  private compileCtes(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.ctes || ast.ctes.length === 0) return '';
    const definitions = ast.ctes
      .map(cte => {
        const name = this.services.quoteIdentifier(cte.name);
        const columns = cte.columns
          ? `(${cte.columns.map(column => this.services.quoteIdentifier(column)).join(', ')})`
          : '';
        const query = this.sources.stripTrailingSemicolon(
          this.services.compileSelectAst(this.services.normalizeSelectAst(cte.query), ctx)
        );
        return `${name}${columns} AS (${query})`;
      })
      .join(', ');
    return `WITH ${definitions} `;
  }
}
