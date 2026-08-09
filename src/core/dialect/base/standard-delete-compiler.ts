import type { CompilerContext } from '../abstract.js';
import type { DeleteQueryNode } from '../../ast/query.js';
import { JoinCompiler } from './join-compiler.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/** Standard DELETE orchestration, independent from concrete dialect classes. */
export class StandardDeleteCompiler {
  public constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: DeleteQueryNode, ctx: CompilerContext): string {
    const target = this.sources.compileTableReference(ast.from);
    const using = this.compileUsingClause(ast, ctx);
    const where = ast.where ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}` : '';
    const returning = this.services.compileReturning(ast.returning, ctx);
    return `DELETE FROM ${target}${using}${where}${returning}`;
  }

  private compileUsingClause(ast: DeleteQueryNode, ctx: CompilerContext): string {
    if (!ast.using && (!ast.joins || ast.joins.length === 0)) return '';
    if (!ast.using) {
      throw new Error('DELETE with JOINs requires a USING clause.');
    }

    const usingTable = this.sources.compileFrom(ast.using, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      (source, compilerContext) => this.sources.compileFrom(source, compilerContext),
      (expression, compilerContext) => this.services.compileExpression(expression, compilerContext)
    );
    return ` USING ${usingTable}${joins}`;
  }
}
