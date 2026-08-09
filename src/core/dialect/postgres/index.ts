import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { BitwiseExpressionNode, ColumnNode, JsonPathNode } from '../../ast/expression.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  TableNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type { CompiledQuery, Dialect } from '../abstract.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { composeSqlDialect } from '../base/sql-dialect-composer.js';
import { PostgresFunctionStrategy } from './functions.js';
import { PostgresTableFunctionStrategy } from './table-functions.js';
import { PostgresProcedureCompiler } from './procedure-compiler.js';
import { PostgresReturningStrategy } from './returning.js';
import { PostgresUpsertStrategy } from './upsert.js';

const quoteIdentifier = (id: string): string => `"${id}"`;

export type PostgresDialectImplementation = Dialect & ProcedureCompiler;

/** Creates the PostgreSQL dialect entirely from composable compiler components. */
export const createPostgresDialect = (): PostgresDialectImplementation => {
  const composition = composeSqlDialect({
    name: 'postgres',
    quoteIdentifier,
    formatPlaceholder: index => `$${index}`,
    functionStrategy: new PostgresFunctionStrategy(),
    tableFunctionStrategy: new PostgresTableFunctionStrategy(),
    returningStrategy: new PostgresReturningStrategy(),
    upsertStrategy: new PostgresUpsertStrategy(),
    supportsDmlReturning: true,
    compileSetTarget: (column: ColumnNode, _table: TableNode) => {
      void _table;
      return quoteIdentifier(column.name);
    },
    compileJsonPath(node: JsonPathNode): string {
      const column = `${quoteIdentifier(node.column.table)}.${quoteIdentifier(node.column.name)}`;
      return `${column}->>'${node.path}'`;
    },
    configureExpressions(api) {
      api.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
        const left = api.compileOperand(node.left, ctx);
        const right = api.compileOperand(node.right, ctx);
        const operator = node.operator === '^' ? '#' : node.operator;
        return `${left} ${operator} ${right}`;
      });
      api.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
        const left = api.compileOperand(node.left, ctx);
        const right = api.compileOperand(node.right, ctx);
        const operator = node.operator === '^' ? '#' : node.operator;
        return `(${left} ${operator} ${right})`;
      });
    }
  });

  const procedures = new PostgresProcedureCompiler(composition.runtime);
  return {
    ...composition.dialect,
    compileProcedureCall: ast => procedures.compileProcedureCall(ast)
  };
};

/** Ergonomic constructor facade over the composed PostgreSQL dialect. */
export class PostgresDialect implements Dialect, ProcedureCompiler {
  private readonly impl: PostgresDialectImplementation = createPostgresDialect();

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

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    return this.impl.compileProcedureCall(ast);
  }
}
