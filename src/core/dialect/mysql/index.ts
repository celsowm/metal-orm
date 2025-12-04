import { CompilerContext, Dialect } from '../abstract.js';
import { SelectQueryNode, InsertQueryNode, UpdateQueryNode, DeleteQueryNode } from '../../ast/query.js';
import { JsonPathNode } from '../../ast/expression.js';

/**
 * MySQL dialect implementation
 */
export class MySqlDialect extends Dialect {
  /**
   * Creates a new MySqlDialect instance
   */
  public constructor() {
    super();
  }

  /**
   * Quotes an identifier using MySQL backtick syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `\`${id}\``;
  }

  /**
   * Compiles JSON path expression using MySQL syntax
   * @param node - JSON path node
   * @returns MySQL JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // MySQL 5.7+ uses col->'$.path'
    return `${col}->'${node.path}'`;
  }

  /**
   * Compiles SELECT query AST to MySQL SQL
   * @param ast - Query AST
   * @param ctx - Compiler context
   * @returns MySQL SQL string
   */
  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
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

    const orderBy = ast.orderBy && ast.orderBy.length > 0
      ? ' ORDER BY ' + ast.orderBy.map(o => `${this.quoteIdentifier(o.column.table)}.${this.quoteIdentifier(o.column.name)} ${o.direction}`).join(', ')
      : '';

    const limit = ast.limit ? ` LIMIT ${ast.limit}` : '';
    const offset = ast.offset ? ` OFFSET ${ast.offset}` : '';

    const ctes = ast.ctes && ast.ctes.length > 0
      ? (() => {
        const hasRecursive = ast.ctes.some(cte => cte.recursive);
        const prefix = hasRecursive ? 'WITH RECURSIVE ' : 'WITH ';
        const cteDefs = ast.ctes.map(cte => {
          const name = this.quoteIdentifier(cte.name);
          const cols = cte.columns ? `(${cte.columns.map(c => this.quoteIdentifier(c)).join(', ')})` : '';
          const query = this.compileSelectAst(cte.query, ctx).trim().replace(/;$/, '');
          return `${name}${cols} AS (${query})`;
        }).join(', ');
        return prefix + cteDefs + ' ';
      })()
      : '';

    return `${ctes}SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${orderBy}${limit}${offset};`;
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
}
