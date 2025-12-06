import { CompilerContext, Dialect } from '../abstract.js';
import { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../../ast/query.js';
import { JsonPathNode } from '../../ast/expression.js';
import type { FunctionRegistry } from '../../functions/function-registry.js';

/**
 * Microsoft SQL Server dialect implementation
 */
export class SqlServerDialect extends Dialect {
  protected readonly dialect = 'mssql';
  /**
   * Creates a new SqlServerDialect instance
   */
  public constructor(functionRegistry?: FunctionRegistry) {
    super(functionRegistry);
  }

  /**
   * Quotes an identifier using SQL Server bracket syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `[${id}]`;
  }

  /**
   * Compiles JSON path expression using SQL Server syntax
   * @param node - JSON path node
   * @returns SQL Server JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // SQL Server uses JSON_VALUE(col, '$.path')
    return `JSON_VALUE(${col}, '${node.path}')`;
  }

  /**
   * Formats parameter placeholders using SQL Server named parameter syntax
   * @param index - Parameter index
   * @returns Named parameter placeholder
   */
  protected formatPlaceholder(index: number): string {
    return `@p${index}`;
  }

  /**
   * Compiles SELECT query AST to SQL Server SQL
   * @param ast - Query AST
   * @param ctx - Compiler context
   * @returns SQL Server SQL string
   */
  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = this.compileCtes(ast, ctx);

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
    const tail = pagination || orderBy;
    return `${ctes}${combined}${tail}`;
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    const table = this.quoteIdentifier(ast.into.name);
    const columnList = ast.columns.map(column => `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`).join(', ');
    const values = ast.values.map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`).join(', ');
    return `INSERT INTO ${table} (${columnList}) VALUES ${values};`;
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const table = this.quoteIdentifier(ast.table.name);
    const assignments = ast.set.map(assignment => {
      const col = assignment.column;
      const target = `${this.quoteIdentifier(col.table)}.${this.quoteIdentifier(col.name)}`;
      const value = this.compileOperand(assignment.value, ctx);
      return `${target} = ${value}`;
    }).join(', ');
    const whereClause = this.compileWhere(ast.where, ctx);
    return `UPDATE ${table} SET ${assignments}${whereClause};`;
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    const table = this.quoteIdentifier(ast.from.name);
    const whereClause = this.compileWhere(ast.where, ctx);
    return `DELETE FROM ${table}${whereClause};`;
  }

  private compileSelectCore(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = ast.columns.map(c => {
      let expr = '';
      if (c.type === 'Function') {
        expr = this.compileOperand(c, ctx);
      } else if (c.type === 'Column') {
        expr = `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`;
      } else if (c.type === 'ScalarSubquery') {
        expr = this.compileOperand(c, ctx);
      } else if (c.type === 'WindowFunction') {
        expr = this.compileOperand(c, ctx);
      }

      if (c.alias) {
        if (c.alias.includes('(')) return c.alias;
        return `${expr} AS ${this.quoteIdentifier(c.alias)}`;
      }
      return expr;
    }).join(', ');

    const distinct = ast.distinct ? 'DISTINCT ' : '';
    const from = `${this.quoteIdentifier(ast.from.name)}`;

    const joins = ast.joins.map(j => {
      const table = this.quoteIdentifier(j.table.name);
      const cond = this.compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    }).join(' ');
    const whereClause = this.compileWhere(ast.where, ctx);

    const groupBy = ast.groupBy && ast.groupBy.length > 0
      ? ' GROUP BY ' + ast.groupBy.map(c => `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`).join(', ')
      : '';

    const having = ast.having
      ? ` HAVING ${this.compileExpression(ast.having, ctx)}`
      : '';

    const orderBy = this.compileOrderBy(ast);
    const pagination = this.compilePagination(ast, orderBy);

    if (pagination) {
      return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${pagination}`;
    }

    return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${orderBy}`;
  }

  private compileOrderBy(ast: SelectQueryNode): string {
    if (!ast.orderBy || ast.orderBy.length === 0) return '';
    return ' ORDER BY ' + ast.orderBy
      .map(o => `${this.quoteIdentifier(o.column.table)}.${this.quoteIdentifier(o.column.name)} ${o.direction}`)
      .join(', ');
  }

  private compilePagination(ast: SelectQueryNode, orderBy: string): string {
    const hasLimit = ast.limit !== undefined;
    const hasOffset = ast.offset !== undefined;
    if (!hasLimit && !hasOffset) return '';

    const off = ast.offset ?? 0;
    const orderClause = orderBy || ' ORDER BY (SELECT NULL)';
    let pagination = `${orderClause} OFFSET ${off} ROWS`;
    if (hasLimit) {
      pagination += ` FETCH NEXT ${ast.limit} ROWS ONLY`;
    }
    return pagination;
  }

  private compileCtes(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.ctes || ast.ctes.length === 0) return '';
    // MSSQL does not use RECURSIVE keyword, but supports recursion when CTE references itself.
    const defs = ast.ctes.map(cte => {
      const name = this.quoteIdentifier(cte.name);
      const cols = cte.columns ? `(${cte.columns.map(c => this.quoteIdentifier(c)).join(', ')})` : '';
      const query = this.compileSelectAst(this.normalizeSelectAst(cte.query), ctx).trim().replace(/;$/, '');
      return `${name}${cols} AS (${query})`;
    }).join(', ');
    return `WITH ${defs} `;
  }

  private wrapSetOperand(sql: string): string {
    const trimmed = sql.trim().replace(/;$/, '');
    return `(${trimmed})`;
  }
}
