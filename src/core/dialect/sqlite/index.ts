import { CompilerContext } from '../abstract.js';
import { JsonPathNode, ColumnNode } from '../../ast/expression.js';
import { SqlDialectBase } from '../base/sql-dialect.js';

/**
 * SQLite dialect implementation
 */
export class SqliteDialect extends SqlDialectBase {
  /**
   * Creates a new SqliteDialect instance
   */
  public constructor() {
    super();
  }

  /**
   * Quotes an identifier using SQLite double-quote syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  /**
   * Compiles JSON path expression using SQLite syntax
   * @param node - JSON path node
   * @returns SQLite JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // SQLite uses json_extract(col, '$.path')
    return `json_extract(${col}, '${node.path}')`;
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    if (!returning || returning.length === 0) return '';
    const columns = returning
      .map(column => {
        const tablePart = column.table ? `${this.quoteIdentifier(column.table)}.` : '';
        return `${tablePart}${this.quoteIdentifier(column.name)}`;
      })
      .join(', ');
    return ` RETURNING ${columns}`;
  }
}
