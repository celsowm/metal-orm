import { CompilerContext } from '../abstract.js';
import { JsonPathNode, ColumnNode } from '../../ast/expression.js';
import { TableNode } from '../../ast/query.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { SqliteFunctionStrategy } from './functions.js';

/**
 * SQLite dialect implementation
 */
export class SqliteDialect extends SqlDialectBase {
  protected readonly dialect = 'sqlite';
  /**
   * Creates a new SqliteDialect instance
   */
  public constructor() {
    super(new SqliteFunctionStrategy());
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

  protected compileQualifiedColumn(column: ColumnNode, _table: TableNode): string {
    return this.quoteIdentifier(column.name);
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    if (!returning || returning.length === 0) return '';
    const columns = this.formatReturningColumns(returning);
    return ` RETURNING ${columns}`;
  }

  protected formatReturningColumns(returning: ColumnNode[]): string {
    return returning
      .map(column => {
        const alias = column.alias ? ` AS ${this.quoteIdentifier(column.alias)}` : '';
        return `${this.quoteIdentifier(column.name)}${alias}`;
      })
      .join(', ');
  }

  supportsReturning(): boolean {
    return true;
  }
}
