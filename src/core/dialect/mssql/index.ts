import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { JsonPathNode } from '../../ast/expression.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type { CompiledQuery, Dialect } from '../abstract.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { composeSqlDialect } from '../base/sql-dialect-composer.js';
import { MssqlFunctionStrategy } from './functions.js';
import { createMssqlCompilerSet } from './compiler-factory.js';
import { MssqlOutputStrategy } from './output.js';
import { MssqlProcedureCompiler } from './procedure-compiler.js';

const quoteIdentifier = (id: string): string => `[${id}]`;

export type SqlServerDialectImplementation = Dialect & ProcedureCompiler;

/** Creates the SQL Server dialect entirely from composable compiler components. */
export const createSqlServerDialect = (): SqlServerDialectImplementation => {
  const composition = composeSqlDialect({
    name: 'mssql',
    quoteIdentifier,
    formatPlaceholder: index => `@p${index}`,
    functionStrategy: new MssqlFunctionStrategy(),
    returningStrategy: new MssqlOutputStrategy(),
    compilerFactory: createMssqlCompilerSet,
    supportsDmlReturning: true,
    compileJsonPath(node: JsonPathNode): string {
      const column = `${quoteIdentifier(node.column.table)}.${quoteIdentifier(node.column.name)}`;
      return `JSON_VALUE(${column}, '${node.path}')`;
    }
  });

  const procedures = new MssqlProcedureCompiler(composition.runtime);
  return {
    ...composition.dialect,
    compileProcedureCall: ast => procedures.compileProcedureCall(ast)
  };
};

/** Ergonomic constructor facade over the composed SQL Server dialect. */
export class SqlServerDialect implements Dialect, ProcedureCompiler {
  private readonly impl: SqlServerDialectImplementation = createSqlServerDialect();

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
