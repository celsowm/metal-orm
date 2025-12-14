import { CompilerContext } from '../abstract.js';
import {
  SelectQueryNode,
  DeleteQueryNode
} from '../../ast/query.js';
import { JsonPathNode } from '../../ast/expression.js';
import { MssqlFunctionStrategy } from './functions.js';
import { OrderByCompiler } from '../base/orderby-compiler.js';
import { JoinCompiler } from '../base/join-compiler.js';
import { SqlDialectBase } from '../base/sql-dialect.js';

/**
 * Microsoft SQL Server dialect implementation
 */
export class SqlServerDialect extends SqlDialectBase {
  protected readonly dialect = 'mssql';
  /**
   * Creates a new SqlServerDialect instance
   */
  public constructor() {
    super(new MssqlFunctionStrategy());
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

    const baseSelect = this.compileSelectCoreForMssql(baseAst, ctx);

    if (!hasSetOps) {
      return `${ctes}${baseSelect}`;
    }

    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.wrapSetOperand(this.compileSelectAst(op.query, ctx))}`)
      .join(' ');

    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);
    const combined = `${this.wrapSetOperand(baseSelect)} ${compound}`;
    const tail = pagination || orderBy;
    return `${ctes}${combined}${tail}`;
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    if (ast.using) {
      throw new Error('DELETE ... USING is not supported in the MSSQL dialect; use join() instead.');
    }

    if (ast.from.type !== 'Table') {
      throw new Error('DELETE only supports base tables in the MSSQL dialect.');
    }

    const alias = ast.from.alias ?? ast.from.name;
    const target = this.compileTableReference(ast.from);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      this.compileFrom.bind(this),
      this.compileExpression.bind(this)
    );
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileReturning(ast.returning, ctx);
    return `DELETE ${this.quoteIdentifier(alias)} FROM ${target}${joins}${whereClause}${returning}`;
  }

  private compileSelectCoreForMssql(ast: SelectQueryNode, ctx: CompilerContext): string {
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
    const from = this.compileTableSource(ast.from);

    const joins = ast.joins.map(j => {
      const table = this.compileTableSource(j.table);
      const cond = this.compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    }).join(' ');
    const whereClause = this.compileWhere(ast.where, ctx);

    const groupBy = ast.groupBy && ast.groupBy.length > 0
      ? ' GROUP BY ' + ast.groupBy.map(term => this.compileOrderingTerm(term, ctx)).join(', ')
      : '';

    const having = ast.having
      ? ` HAVING ${this.compileExpression(ast.having, ctx)}`
      : '';

    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);

    if (pagination) {
      return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${pagination}`;
    }

    return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${orderBy}`;
  }

  private compileOrderBy(ast: SelectQueryNode, ctx: CompilerContext): string {
    return OrderByCompiler.compileOrderBy(
      ast,
      term => this.compileOrderingTerm(term, ctx),
      this.renderOrderByNulls.bind(this),
      this.renderOrderByCollation.bind(this)
    );
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

}
