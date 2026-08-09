import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { IsDistinctExpressionNode, JsonPathNode } from '../../ast/expression.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type { CompiledQuery, Dialect } from '../abstract.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { composeSqlDialect } from '../base/sql-dialect-composer.js';
import { MysqlFunctionStrategy } from './functions.js';
import { MySqlProcedureCompiler } from './procedure-compiler.js';
import { MySqlUpsertStrategy } from './upsert.js';

const quoteIdentifier = (id: string): string => `\`${id}\``;

export type MySqlDialectImplementation = Dialect & ProcedureCompiler;

/** Creates the MySQL dialect entirely from composable compiler components. */
export const createMySqlDialect = (): MySqlDialectImplementation => {
  const composition = composeSqlDialect({
    name: 'mysql',
    quoteIdentifier,
    functionStrategy: new MysqlFunctionStrategy(),
    upsertStrategy: new MySqlUpsertStrategy(),
    compileJsonPath(node: JsonPathNode): string {
      const column = `${quoteIdentifier(node.column.table)}.${quoteIdentifier(node.column.name)}`;
      return `${column}->'${node.path}'`;
    },
    configureExpressions(api) {
      api.registerExpressionCompiler(
        'IsDistinctExpression',
        (node: IsDistinctExpressionNode, ctx): string => {
          const left = api.compileOperand(node.left, ctx);
          const right = api.compileOperand(node.right, ctx);
          const spaceship = `${left} <=> ${right}`;
          return node.operator === 'IS NOT DISTINCT FROM'
            ? spaceship
            : `NOT (${spaceship})`;
        }
      );
    }
  });

  const procedures = new MySqlProcedureCompiler(composition.runtime);
  return {
    ...composition.dialect,
    compileProcedureCall: ast => procedures.compileProcedureCall(ast)
  };
};

/** Ergonomic constructor facade over the composed MySQL dialect. */
export class MySqlDialect implements Dialect, ProcedureCompiler {
  private readonly impl: MySqlDialectImplementation = createMySqlDialect();

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
