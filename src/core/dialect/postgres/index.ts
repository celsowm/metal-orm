import { CompilerContext } from '../abstract.js';
import { JsonPathNode, ColumnNode } from '../../ast/expression.js';
import { SqlDialectBase } from '../base/sql-dialect.js';

/**
 * PostgreSQL dialect implementation
 */
export class PostgresDialect extends SqlDialectBase {
  /**
   * Creates a new PostgresDialect instance
   */
  public constructor() {
    super();
  }

  /**
   * Quotes an identifier using PostgreSQL double-quote syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  /**
   * Compiles JSON path expression using PostgreSQL syntax
   * @param node - JSON path node
   * @returns PostgreSQL JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // Postgres uses col->>'path' for text extraction
    return `${col}->>'${node.path}'`;
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
