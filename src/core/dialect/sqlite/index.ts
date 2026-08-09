import type { BitwiseExpressionNode, ColumnNode, JsonPathNode } from '../../ast/expression.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  TableNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type { CompiledQuery, Dialect } from '../abstract.js';
import { composeSqlDialect } from '../base/sql-dialect-composer.js';
import { SqliteFunctionStrategy } from './functions.js';
import { SqliteReturningStrategy } from './returning.js';
import { SqliteUpsertStrategy } from './upsert.js';

const quoteIdentifier = (id: string): string => `"${id}"`;

/** Creates the SQLite dialect entirely from composable compiler components. */
export const createSqliteDialect = (): Dialect =>
  composeSqlDialect({
    name: 'sqlite',
    quoteIdentifier,
    functionStrategy: new SqliteFunctionStrategy(),
    returningStrategy: new SqliteReturningStrategy(),
    upsertStrategy: new SqliteUpsertStrategy(),
    supportsDmlReturning: true,
    compileSetTarget: (column: ColumnNode, _table: TableNode) => {
      void _table;
      return quoteIdentifier(column.name);
    },
    compileJsonPath(node: JsonPathNode): string {
      const column = `${quoteIdentifier(node.column.table)}.${quoteIdentifier(node.column.name)}`;
      return `json_extract(${column}, '${node.path}')`;
    },
    configureExpressions(api) {
      api.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
        const left = api.compileOperand(node.left, ctx);
        const right = api.compileOperand(node.right, ctx);
        if (node.operator === '^') {
          return `(${left} | ${right}) & ~(${left} & ${right})`;
        }
        return `${left} ${node.operator} ${right}`;
      });
      api.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
        const left = api.compileOperand(node.left, ctx);
        const right = api.compileOperand(node.right, ctx);
        if (node.operator === '^') {
          return `((${left} | ${right}) & ~(${left} & ${right}))`;
        }
        return `(${left} ${node.operator} ${right})`;
      });
    }
  }).dialect;

/** Ergonomic constructor facade over the composed SQLite dialect. */
export class SqliteDialect implements Dialect {
  private readonly impl: Dialect = createSqliteDialect();

  quoteIdentifier(id: string): string {
    return this.impl.quoteIdentifier(id);
  }

  supportsDmlReturningClause(): boolean {
    return this.impl.supportsDmlReturningClause();
  }

  compileSelect(ast: SelectQueryNode): CompiledQuery {
    return this.impl.compileSelect(ast);
  }

  compileInsert(ast: InsertQueryNode): CompiledQuery {
    return this.impl.compileInsert(ast);
  }

  compileUpdate(ast: UpdateQueryNode): CompiledQuery {
    return this.impl.compileUpdate(ast);
  }

  compileDelete(ast: DeleteQueryNode): CompiledQuery {
    return this.impl.compileDelete(ast);
  }
}
