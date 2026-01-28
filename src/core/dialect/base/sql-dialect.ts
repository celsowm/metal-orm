import { CompilerContext, Dialect } from '../abstract.js';
import {
  SelectQueryNode,
  InsertQueryNode,
  UpdateQueryNode,
  DeleteQueryNode,
  InsertSourceNode,
  TableSourceNode,
  DerivedTableNode,
  FunctionTableNode,
  OrderByNode,
  TableNode
} from '../../ast/query.js';
import { ColumnNode, OperandNode } from '../../ast/expression.js';
import { FunctionTableFormatter } from './function-table-formatter.js';
import { PaginationStrategy, StandardLimitOffsetPagination } from './pagination-strategy.js';
import { CteCompiler } from './cte-compiler.js';
import { ReturningStrategy, NoReturningStrategy } from './returning-strategy.js';
import { JoinCompiler } from './join-compiler.js';
import { GroupByCompiler } from './groupby-compiler.js';
import { OrderByCompiler } from './orderby-compiler.js';


/**
 * Base class for SQL dialects.
 * Provides a common framework for compiling AST nodes into SQL strings.
 * Specific dialects should extend this class and implement dialect-specific logic.
 */
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
    const orderBy = OrderByCompiler.compileOrderBy(
      ast,
      term => this.compileOrderingTerm(term, ctx),
      this.renderOrderByNulls.bind(this),
      this.renderOrderByCollation.bind(this)
    );
    const pagination = this.paginationStrategy.compilePagination(ast.limit, ast.offset);
    const combined = `${this.wrapSetOperand(baseSelect)} ${compound}`;
    return `${ctes}${combined}${orderBy}${pagination}`;
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.columns.length) {
      throw new Error('INSERT queries must specify columns.');
    }

    const table = this.compileTableName(ast.into);
    const columnList = this.compileInsertColumnList(ast.columns);
    const source = this.compileInsertSource(ast.source, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `INSERT INTO ${table} (${columnList}) ${source}${returning}`;
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    return this.returningStrategy.compileReturning(returning, ctx);
  }

  private compileInsertSource(source: InsertSourceNode, ctx: CompilerContext): string {
    if (source.type === 'InsertValues') {
      if (!source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const values = source.rows
        .map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `VALUES ${values}`;
    }

    const normalized = this.normalizeSelectAst(source.query);
    return this.compileSelectAst(normalized, ctx).trim();
  }

  private compileInsertColumnList(columns: ColumnNode[]): string {
    return columns.map(column => this.quoteIdentifier(column.name)).join(', ');
  }

  private compileSelectCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = this.compileSelectColumns(ast, ctx);
    const from = this.compileFrom(ast.from, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      this.compileFrom.bind(this),
      this.compileExpression.bind(this)
    );
    const whereClause = this.compileWhere(ast.where, ctx);
    const groupBy = GroupByCompiler.compileGroupBy(ast, term => this.compileOrderingTerm(term, ctx));
    const having = this.compileHaving(ast, ctx);
    const orderBy = OrderByCompiler.compileOrderBy(
      ast,
      term => this.compileOrderingTerm(term, ctx),
      this.renderOrderByNulls.bind(this),
      this.renderOrderByCollation.bind(this)
    );
    const pagination = this.paginationStrategy.compilePagination(ast.limit, ast.offset);
    return `SELECT ${this.compileDistinct(ast)}${columns} FROM ${from}${joins}${whereClause}${groupBy}${having}${orderBy}${pagination}`;
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const target = this.compileTableReference(ast.table);
    const assignments = this.compileUpdateAssignments(ast.set, ast.table, ctx);
    const fromClause = this.compileUpdateFromClause(ast, ctx);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `UPDATE ${target} SET ${assignments}${fromClause}${whereClause}${returning}`;
  }

  protected compileUpdateAssignments(
    assignments: { column: ColumnNode; value: OperandNode }[],
    table: TableNode,
    ctx: CompilerContext
  ): string {
    return assignments
      .map(assignment => {
        const col = assignment.column;
        const target = this.compileSetTarget(col, table);
        const value = this.compileOperand(assignment.value, ctx);
        return `${target} = ${value}`;
      })
      .join(', ');
  }

  protected compileSetTarget(column: ColumnNode, table: TableNode): string {
    return this.compileQualifiedColumn(column, table);
  }

  protected compileQualifiedColumn(column: ColumnNode, table: TableNode): string {
    const baseTableName = table.name;
    const alias = table.alias;
    const columnTable = column.table ?? alias ?? baseTableName;
    const tableQualifier =
      alias && column.table === baseTableName ? alias : columnTable;

    if (!tableQualifier) {
      return this.quoteIdentifier(column.name);
    }

    return `${this.quoteIdentifier(tableQualifier)}.${this.quoteIdentifier(column.name)}`;
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    const target = this.compileTableReference(ast.from);
    const usingClause = this.compileDeleteUsingClause(ast, ctx);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `DELETE FROM ${target}${usingClause}${whereClause}${returning}`;
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
    const tableSource = ast;
    if (tableSource.type === 'FunctionTable') {
      return this.compileFunctionTable(tableSource, ctx);
    }
    if (tableSource.type === 'DerivedTable') {
      return this.compileDerivedTable(tableSource, ctx);
    }
    return this.compileTableSource(tableSource);
  }

  protected compileFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    const key = fn.key ?? fn.name;

    if (ctx) {
      const renderer = this.tableFunctionStrategy.getRenderer(key);
      if (renderer) {
        const compiledArgs = (fn.args ?? []).map(arg => this.compileOperand(arg, ctx));
        return renderer({
          node: fn,
          compiledArgs,
          compileOperand: operand => this.compileOperand(operand, ctx),
          quoteIdentifier: this.quoteIdentifier.bind(this)
        });
      }

      if (fn.key) {
        throw new Error(`Table function "${key}" is not supported by dialect "${this.dialect}".`);
      }
    }

    return FunctionTableFormatter.format(fn, ctx, this);
  }

  protected compileDerivedTable(table: DerivedTableNode, ctx?: CompilerContext): string {
    if (!table.alias) {
      throw new Error('Derived tables must have an alias.');
    }
    const subquery = this.compileSelectAst(this.normalizeSelectAst(table.query), ctx!).trim().replace(/;$/, '');
    const columns = table.columnAliases?.length
      ? ` (${table.columnAliases.map(c => this.quoteIdentifier(c)).join(', ')})`
      : '';
    return `(${subquery}) AS ${this.quoteIdentifier(table.alias)}${columns}`;
  }

  protected compileTableSource(table: TableSourceNode): string {
    if (table.type === 'FunctionTable') {
      return this.compileFunctionTable(table as FunctionTableNode);
    }
    if (table.type === 'DerivedTable') {
      return this.compileDerivedTable(table as DerivedTableNode);
    }
    const base = this.compileTableName(table);
    return table.alias ? `${base} AS ${this.quoteIdentifier(table.alias)}` : base;
  }

  protected compileTableName(table: { name: string; schema?: string; alias?: string }): string {
    if (table.schema) {
      return `${this.quoteIdentifier(table.schema)}.${this.quoteIdentifier(table.name)}`;
    }
    return this.quoteIdentifier(table.name);
  }

  protected compileTableReference(table: { name: string; schema?: string; alias?: string }): string {
    const base = this.compileTableName(table);
    return table.alias ? `${base} AS ${this.quoteIdentifier(table.alias)}` : base;
  }

  private compileUpdateFromClause(ast: UpdateQueryNode, ctx: CompilerContext): string {
    if (!ast.from && (!ast.joins || ast.joins.length === 0)) return '';
    if (!ast.from) {
      throw new Error('UPDATE with JOINs requires an explicit FROM clause.');
    }
    const from = this.compileFrom(ast.from, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      this.compileFrom.bind(this),
      this.compileExpression.bind(this)
    );
    return ` FROM ${from}${joins}`;
  }

  private compileDeleteUsingClause(ast: DeleteQueryNode, ctx: CompilerContext): string {
    if (!ast.using && (!ast.joins || ast.joins.length === 0)) return '';
    if (!ast.using) {
      throw new Error('DELETE with JOINs requires a USING clause.');
    }
    const usingTable = this.compileFrom(ast.using, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      this.compileFrom.bind(this),
      this.compileExpression.bind(this)
    );
    return ` USING ${usingTable}${joins}`;
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

  protected renderOrderByNulls(order: OrderByNode): string | undefined {
    return order.nulls ? ` NULLS ${order.nulls}` : '';
  }

  protected renderOrderByCollation(order: OrderByNode): string | undefined {
    return order.collation ? ` COLLATE ${order.collation}` : '';
  }
}
