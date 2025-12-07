import { CompilerContext, Dialect } from '../abstract.js';
import { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../../ast/query.js';
import { ColumnNode } from '../../ast/expression.js';

/**
 * Shared SQL compiler for dialects with standard LIMIT/OFFSET pagination.
 * Focuses on orchestration, delegating complexity to focused private methods.
 * Concrete dialects override only the minimal hooks (identifier quoting,
 * JSON path, placeholders, RETURNING support) instead of re-implementing
 * the entire compile pipeline.
 *
 * SOLID Principles Applied:
 * - SRP: Each private method has a single, clear responsibility
 * - OCP: Dialects extend behavior without modifying existing code
 * - LSP: All implementations maintain consistent compilation contracts
 * - ISP: The public interface exposes only what's needed
 * - DIP: Depends on abstract Dialect class, not concrete implementations
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

    return this.compileSelectWithSetOps(ast, baseSelect, ctes, ctx);
  }

  /**
   * Handles SELECT compilation when set operations (UNION, INTERSECT, EXCEPT) are present.
   * Extracted to reduce method complexity and improve readability.
   */
  private compileSelectWithSetOps(
    ast: SelectQueryNode,
    baseSelect: string,
    ctes: string,
    ctx: CompilerContext
  ): string {
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
    const columnList = this.compileInsertColumnList(ast.columns);
    const values = this.compileInsertValues(ast.values, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `INSERT INTO ${table} (${columnList}) VALUES ${values}${returning}`;
  }

  /**
   * Compiles the column list for INSERT statements.
   * Extracted for single responsibility and reusability.
   */
  private compileInsertColumnList(columns: ColumnNode[]): string {
    return columns
      .map(column => `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`)
      .join(', ');
  }

  /**
   * Compiles the VALUES clause for INSERT statements.
   * Extracted for clarity and to improve testability.
   */
  private compileInsertValues(values: any[][], ctx: CompilerContext): string {
    return values
      .map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`)
      .join(', ');
  }

  /**
   * Compiles a single SELECT (no set operations, no CTE prefix).
   * Orchestrates compilation of individual clauses.
   */
  private compileSelectCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = this.compileSelectColumns(ast, ctx);
    const from = this.compileFrom(ast.from, ctx);
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
    const assignments = this.compileUpdateAssignments(ast.set, ctx);
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `UPDATE ${table} SET ${assignments}${whereClause}${returning}`;
  }

  /**
   * Compiles the assignments (SET clause) for UPDATE statements.
   * Extracted for single responsibility and reusability.
   */
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

  protected compileFrom(ast: SelectQueryNode['from'], ctx?: CompilerContext): string {
    const tableSource = ast as any;
    if (tableSource.type === 'FunctionTable') {
      return this.compileFunctionTable(tableSource, ctx);
    }
    return this.compileTableSource(tableSource);
  }

  /**
   * Compiles a FunctionTableNode (e.g., LATERAL unnest(...) WITH ORDINALITY).
   * Delegates to specialized formatter for better separation of concerns.
   */
  protected compileFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    return this.formatFunctionTable(fn, ctx);
  }

  /**
   * Formats function table components.
   * Extracted to reduce method complexity.
   */
  private formatFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    const schemaPart = this.formatFunctionTableSchema(fn);
    const args = this.formatFunctionTableArgs(fn, ctx);
    const base = this.formatFunctionTableBase(fn, schemaPart, args);
    const lateral = this.formatFunctionTableLateral(fn);
    const alias = this.formatFunctionTableAlias(fn);
    const colAliases = this.formatFunctionTableColumnAliases(fn);
    return `${lateral}${base}${alias}${colAliases}`;
  }

  /**
   * Formats the schema prefix for function tables.
   */
  private formatFunctionTableSchema(fn: FunctionTableNode): string {
    return fn.schema ? `${this.quoteIdentifier(fn.schema)}.` : '';
  }

  /**
   * Formats function table arguments.
   */
  private formatFunctionTableArgs(fn: FunctionTableNode, ctx?: CompilerContext): string {
    return (fn.args || [])
      .map((a: any) => ctx ? this.compileOperand(a, ctx) : String(a))
      .join(', ');
  }

  /**
   * Formats the base function call with ordinality if present.
   */
  private formatFunctionTableBase(fn: FunctionTableNode, schemaPart: string, args: string): string {
    const ordinality = fn.withOrdinality ? ' WITH ORDINALITY' : '';
    return `${schemaPart}${this.quoteIdentifier(fn.name)}(${args})${ordinality}`;
  }

  /**
   * Formats the LATERAL keyword for function tables.
   */
  private formatFunctionTableLateral(fn: FunctionTableNode): string {
    return fn.lateral ? 'LATERAL ' : '';
  }

  /**
   * Formats the table alias for function tables.
   */
  private formatFunctionTableAlias(fn: FunctionTableNode): string {
    return fn.alias ? ` AS ${this.quoteIdentifier(fn.alias)}` : '';
  }

  /**
   * Formats column aliases for function tables.
   */
  private formatFunctionTableColumnAliases(fn: FunctionTableNode): string {
    if (!fn.columnAliases || !fn.columnAliases.length) return '';
    const aliases = fn.columnAliases
      .map((c: string) => this.quoteIdentifier(c))
      .join(', ');
    return `(${aliases})`;
  }

  /**
   * Compiles a regular TableNode (table source with optional alias).
   */
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

  protected compileJoins(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.joins || ast.joins.length === 0) return '';
    const parts = ast.joins.map(j => {
      const table = this.compileFrom(j.table as any, ctx);
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
   * Override to implement dialect-specific pagination (e.g., ROWS FETCH FIRST).
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


/**
 * Encapsulates FunctionTable node structure.
 * Provides type safety instead of using `any` for better IDE support and refactoring safety.
 */
interface FunctionTableNode {
  type: 'FunctionTable';
  schema?: string;
  name: string;
  args?: unknown[];
  lateral?: boolean;
  withOrdinality?: boolean;
  alias?: string;
  columnAliases?: string[];
}

/**
 * Encapsulates TableSource node structure.
 * Provides type safety and clear interface.
 */
interface TableSourceNode {
  name: string;
  schema?: string;
  alias?: string;
}
