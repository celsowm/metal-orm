import type { BitwiseExpressionNode, ColumnNode, JsonPathNode } from '../../ast/expression.js';
import type { TableNode } from '../../ast/query.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { SqliteFunctionStrategy } from './functions.js';
import { SqliteReturningStrategy } from './returning.js';
import { SqliteUpsertStrategy } from './upsert.js';

/** SQLite dialect assembled from reusable compiler components. */
export class SqliteDialect extends SqlDialectBase {
  protected readonly dialect = 'sqlite';

  public constructor() {
    super({
      functionStrategy: new SqliteFunctionStrategy(),
      returningStrategy: new SqliteReturningStrategy(),
      upsertStrategy: new SqliteUpsertStrategy(),
      supportsDmlReturning: true
    });

    this.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      if (node.operator === '^') {
        return `(${left} | ${right}) & ~(${left} & ${right})`;
      }
      return `${left} ${node.operator} ${right}`;
    });
    this.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      if (node.operator === '^') {
        return `((${left} | ${right}) & ~(${left} & ${right}))`;
      }
      return `(${left} ${node.operator} ${right})`;
    });
  }

  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  protected compileJsonPath(node: JsonPathNode): string {
    const column = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    return `json_extract(${column}, '${node.path}')`;
  }

  protected compileQualifiedColumn(column: ColumnNode, _table: TableNode): string {
    void _table;
    return this.quoteIdentifier(column.name);
  }
}
