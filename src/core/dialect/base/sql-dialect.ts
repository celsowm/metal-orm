import { CompilerContext, Dialect } from '../abstract.js';
import { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../../ast/query.js';
import { ColumnNode } from '../../ast/expression.js';
import { FunctionTableFormatter, FunctionTableNode } from './function-table-formatter.js';
import { PaginationStrategy, StandardLimitOffsetPagination } from './pagination-strategy.js';
import { CteCompiler } from './cte-compiler.js';
import { ReturningStrategy, NoReturningStrategy } from './returning-strategy.js';
import { JoinCompiler } from './join-compiler.js';
import { GroupByCompiler } from './groupby-compiler.js';
import { OrderByCompiler } from './orderby-compiler.js';


export abstract class SqlDialectBase extends Dialect {
  abstract quoteIdentifier(id: string): string;

  protected paginationStrategy: PaginationStrategy = new StandardLimitOffsetPagination();
  protected returningStrategy: ReturningStrategy = new NoReturningStrategy();

  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = CteCompiler.compileCtes(
      ast,
      ctx,
      this.quoteIdentifier.bind(this),
      this.compileSelectAst.bind(this),
      this.normalizeSelectAst?.bind(this) ?? ((a) => a),
      this.stripTrailingSemicolon.bind(this)
    );
    const baseAst: SelectQueryNode = hasSetOps
      ? { ...ast, setOps: undefined, orderBy: undefined, limit: undefined, offset: undefined }
      : ast;
    const baseSelect = this.compileSelectCore(baseAst, ctx);
    if (!hasSetOps) {
      return `${ctes}${baseSelect}`;
    }
    return this.compileSelectWithSetOps(ast, baseSelect, ctes, ctx);
  }

  private compileSelectWithSetOps(
    ast: SelectQueryNode,
    baseSelect: string,
    ctes: string,
    ctx: CompilerContext
  ): string {
    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.wrapSetOperand(this.compileSelectAst(op.query, ctx))}`)
      .join(' ');
    const orderBy = OrderByCompiler.compileOrderBy(ast, this.quoteIdentifier.bind(this));
    const pagination = this.paginationStrategy.compilePagination(ast.limit, ast.offset);
    const combined = `${this.wrapSetOperand(baseSelect)} ${compound}`;
    return `${ctes}${combined}${orderBy}${pagination}`;
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.into);
    const columnList = this.compileInsertColumnList(ast.columns);
    const values = this.compileInsertValues(ast.values, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `INSERT INTO ${table} (${columnList}) VALUES ${values}${returning}`;
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    return this.returningStrategy.compileReturning(returning, ctx);
  }

  private compileInsertColumnList(columns: ColumnNode[]): string {
    return columns
      .map(column => `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`)
      .join(', ');
  }

  private compileInsertValues(values: any[][], ctx: CompilerContext): string {
    return values
      .map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`)
      .join(', ');
  }

  private compileSelectCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = this.compileSelectColumns(ast, ctx);
    const from = this.compileFrom(ast.from, ctx);
    const joins = JoinCompiler.compileJoins(ast, ctx, this.compileFrom.bind(this), this.compileExpression.bind(this));
    const whereClause = this.compileWhere(ast.where, ctx);
    const groupBy = GroupByCompiler.compileGroupBy(ast, this.quoteIdentifier.bind(this));
    const having = this.compileHaving(ast, ctx);
    const orderBy = OrderByCompiler.compileOrderBy(ast, this.quoteIdentifier.bind(this));
    const pagination = this.paginationStrategy.compilePagination(ast.limit, ast.offset);
    return `SELECT ${this.compileDistinct(ast)}${columns} FROM ${from}${joins}${whereClause}${groupBy}${having}${orderBy}${pagination}`;
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.table);
    const assignments = this.compileUpdateAssignments(ast.set, ctx);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `UPDATE ${table} SET ${assignments}${whereClause}${returning}`;
  }

  private compileUpdateAssignments(
    assignments: { column: ColumnNode; value: any }[],
    ctx: CompilerContext
  ): string {
    return assignments
      .map(assignment => {
        const col = assignment.column;
        const target = `${this.quoteIdentifier(col.table)}.${this.quoteIdentifier(col.name)}`;
        const value = this.compileOperand(assignment.value, ctx);
        return `${target} = ${value}`;
      })
      .join(', ');
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    const table = this.compileTableName(ast.from);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `DELETE FROM ${table}${whereClause}${returning}`;
  }

  protected formatReturningColumns(returning: ColumnNode[]): string {
    return this.returningStrategy.formatReturningColumns(returning, this.quoteIdentifier.bind(this));
  }

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

  protected compileFrom(ast: SelectQueryNode['from'], ctx?: CompilerContext): string {
    const tableSource = ast as any;
    if (tableSource.type === 'FunctionTable') {
      return this.compileFunctionTable(tableSource, ctx);
    }
    return this.compileTableSource(tableSource);
  }

  protected compileFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    return FunctionTableFormatter.format(fn, ctx, this);
  }

  protected compileTableSource(table: TableSourceNode): string {
    const base = this.compileTableName(table);
    return table.alias ? `${base} AS ${this.quoteIdentifier(table.alias)}` : base;
  }

  protected compileTableName(table: { name: string; schema?: string }): string {
    if (table.schema) {
      return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
    }
    return this.quoteIdentifier(table.name);
  }

  protected compileHaving(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.having) return '';
    return ` HAVING ${this.compileExpression(ast.having, ctx)}`;
  }

  protected stripTrailingSemicolon(sql: string): string {
    return sql.trim().replace(/;$/, '');
  }

  protected wrapSetOperand(sql: string): string {
    const trimmed = this.stripTrailingSemicolon(sql);
    return `(${trimmed})`;
  }
}

interface TableSourceNode {
  name: string;
  schema?: string;
  alias?: string;
}
