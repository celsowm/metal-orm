import { JsonPathNode } from '../../ast/expression.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import type { FunctionRegistry } from '../../functions/function-registry.js';

/**
 * MySQL dialect implementation
 */
export class MySqlDialect extends SqlDialectBase {
  protected readonly dialect = 'mysql';
  /**
   * Creates a new MySqlDialect instance
   */
  public constructor(functionRegistry?: FunctionRegistry) {
    super(functionRegistry);
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
}
