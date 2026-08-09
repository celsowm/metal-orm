import type { DeleteQueryNode } from '../../ast/query.js';
import type { CompilerContext } from '../abstract.js';
import { JoinCompiler } from '../base/join-compiler.js';
import type { SqlAstCompiler } from '../base/sql-compiler-set.js';
import type { StandardSqlCompilerServices } from '../base/standard-sql-services.js';
import type { StandardSqlSourceCompiler } from '../base/standard-sql-source-compiler.js';
import { MssqlOutputStrategy } from './output.js';

export class MssqlDeleteCompiler implements SqlAstCompiler<DeleteQueryNode> {
  private readonly output = new MssqlOutputStrategy();

  constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: DeleteQueryNode, ctx: CompilerContext): string {
    if (ast.using) {
      throw new Error('DELETE ... USING is not supported in the MSSQL dialect; use join() instead.');
    }

    const alias = ast.from.alias ?? ast.from.name;
    const target = this.sources.compileTableReference(ast.from);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      (source, compilerContext) => this.sources.compileFrom(source, compilerContext),
      (expression, compilerContext) => this.services.compileExpression(expression, compilerContext)
    );
    const where = ast.where
      ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}`
      : '';
    const returning = this.output.compileOutput(
      ast.returning,
      'deleted',
      id => this.services.quoteIdentifier(id)
    );
    return `DELETE ${this.services.quoteIdentifier(alias)}${returning} FROM ${target}${joins}${where}`;
  }
}
