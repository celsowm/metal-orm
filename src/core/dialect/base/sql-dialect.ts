import { CompilerContext, Dialect } from '../abstract.js';
import { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../../ast/query.js';
import { ColumnNode } from '../../ast/expression.js';

/**
 * Shared SQL compiler for dialects with standard LIMIT/OFFSET pagination.
 * Concrete dialects override only the minimal hooks (identifier quoting,
 * JSON path, placeholders, RETURNING support) instead of re-implementing
 * the entire compile pipeline.
 */
export abstract class SqlDialectBase extends Dialect {
  /**
   * Quotes an identifier (dialect-specific).
   */
  abstract quoteIdentifier(id: string): string;

  /**
   * Compiles SELECT query AST to SQL using common rules.
   */
  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = this.compileCtes(ast, ctx);

    // When set operations exist, omit ORDER BY/OFFSET/LIMIT from the operands and apply at the end.
    const baseAst: SelectQueryNode = hasSetOps
      ? { ...ast, setOps: undefined, orderBy: undefined, limit: undefined, offset: undefined }
      : ast;

    const baseSelect = this.compileSelectCore(baseAst, ctx);

    if (!hasSetOps) {
      return `${ctes}${baseSelect}`;
    }

    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.wrapSetOperand(this.compileSelectAst(op.query, ctx))}`)
      .join(' ');

    const orderBy = this.compileOrderBy(ast);
    const pagination = this.compilePagination(ast, orderBy);

    const combined = `${this.wrapSetOperand(baseSelect)} ${compound}`;
    return `${ctes}${combined}${orderBy}${pagination}`;
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.into);
    const columnList = ast.columns
      .map(column => `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`)
      .join(', ');
    const values = ast.values.map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`).join(', ');
    const returning = this.compileReturning(ast.returning, ctx);
    return `INSERT INTO ${table} (${columnList}) VALUES ${values}${returning}`;
  }

  /**
   * Compiles a single SELECT (no set operations, no CTE prefix).
   */
  private compileSelectCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = this.compileSelectColumns(ast, ctx);
    const from = this.compileFrom(ast.from);
    const joins = this.compileJoins(ast, ctx);
    const whereClause = this.compileWhere(ast.where, ctx);
    const groupBy = this.compileGroupBy(ast);
    const having = this.compileHaving(ast, ctx);
    const orderBy = this.compileOrderBy(ast);
    const pagination = this.compilePagination(ast, orderBy);

    return `SELECT ${this.compileDistinct(ast)}${columns} FROM ${from}${joins}${whereClause}${groupBy}${having}${orderBy}${pagination}`;
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.table);
    const assignments = ast.set.map(assignment => {
      const col = assignment.column;
      const target = `${this.quoteIdentifier(col.table)}.${this.quoteIdentifier(col.name)}`;
      const value = this.compileOperand(assignment.value, ctx);
      return `${target} = ${value}`;
    }).join(', ');
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `UPDATE ${table} SET ${assignments}${whereClause}${returning}`;
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.from);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `DELETE FROM ${table}${whereClause}${returning}`;
  }

  /**
   * Default RETURNING compilation: no support.
   */
  protected compileReturning(returning: ColumnNode[] | undefined, _ctx: CompilerContext): string {
    if (!returning || returning.length === 0) return '';
    throw new Error('RETURNING is not supported by this dialect.');
  }

  protected formatReturningColumns(returning: ColumnNode[]): string {
    return returning
      .map(column => {
        const tablePart = column.table ? `${this.quoteIdentifier(column.table)}.` : '';
        const aliasPart = column.alias ? ` AS ${this.quoteIdentifier(column.alias)}` : '';
        return `${tablePart}${this.quoteIdentifier(column.name)}${aliasPart}`;
      })
      .join(', ');
  }

  /**
   * DISTINCT clause. Override for DISTINCT ON support.
   */
  protected compileDistinct(ast: SelectQueryNode): string {
    return ast.distinct ? 'DISTINCT ' : '';
  }

  protected compileSelectColumns(ast: SelectQueryNode, ctx: CompilerContext): string {
    return ast.columns.map(c => {
      const expr = this.compileOperand(c, ctx);
      if (c.alias) {
        if (c.alias.includes('(')) return c.alias;
        return `${expr} AS ${this.quoteIdentifier(c.alias)}`;
      }
      return expr;
    }).join(', ');
  }

  protected compileFrom(ast: SelectQueryNode['from']): string {
    const base = this.compileTableName(ast);
    return ast.alias ? `${base} AS ${this.quoteIdentifier(ast.alias)}` : base;
  }

  protected compileTableName(table: { name: string; schema?: string }): string {
    if (table.schema) {
      return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
    }
    return this.quoteIdentifier(table.name);
  }

  protected compileJoins(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.joins || ast.joins.length === 0) return '';
    const parts = ast.joins.map(j => {
      const table = this.compileFrom(j.table);
      const cond = this.compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    });
    return ` ${parts.join(' ')}`;
  }

  protected compileGroupBy(ast: SelectQueryNode): string {
    if (!ast.groupBy || ast.groupBy.length === 0) return '';
    const cols = ast.groupBy
      .map(c => `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`)
      .join(', ');
    return ` GROUP BY ${cols}`;
  }

  protected compileHaving(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.having) return '';
    return ` HAVING ${this.compileExpression(ast.having, ctx)}`;
  }

  protected compileOrderBy(ast: SelectQueryNode): string {
    if (!ast.orderBy || ast.orderBy.length === 0) return '';
    const parts = ast.orderBy
      .map(o => `${this.quoteIdentifier(o.column.table)}.${this.quoteIdentifier(o.column.name)} ${o.direction}`)
      .join(', ');
    return ` ORDER BY ${parts}`;
  }

  /**
   * Default LIMIT/OFFSET pagination clause.
   */
  protected compilePagination(ast: SelectQueryNode, _orderByClause: string): string {
    const parts: string[] = [];
    if (ast.limit !== undefined) parts.push(`LIMIT ${ast.limit}`);
    if (ast.offset !== undefined) parts.push(`OFFSET ${ast.offset}`);
    return parts.length ? ` ${parts.join(' ')}` : '';
  }

  protected compileCtes(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.ctes || ast.ctes.length === 0) return '';
    const hasRecursive = ast.ctes.some(cte => cte.recursive);
    const prefix = hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
    const cteDefs = ast.ctes.map(cte => {
      const name = this.quoteIdentifier(cte.name);
      const cols = cte.columns && cte.columns.length
        ? `(${cte.columns.map(c => this.quoteIdentifier(c)).join(', ')})`
        : '';
      const query = this.stripTrailingSemicolon(this.compileSelectAst(this.normalizeSelectAst(cte.query), ctx));
      return `${name}${cols} AS (${query})`;
    }).join(', ');
    return `${prefix}${cteDefs} `;
  }

  protected stripTrailingSemicolon(sql: string): string {
    return sql.trim().replace(/;$/, '');
  }

  protected wrapSetOperand(sql: string): string {
    const trimmed = this.stripTrailingSemicolon(sql);
    return `(${trimmed})`;
  }
}
