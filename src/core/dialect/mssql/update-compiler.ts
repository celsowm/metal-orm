import type { UpdateQueryNode } from '../../ast/query.js';
import type { CompilerContext } from '../abstract.js';
import type { SqlAstCompiler } from '../base/sql-compiler-set.js';
import type { StandardSqlCompilerServices } from '../base/standard-sql-services.js';
import { StandardUpdateCompiler } from '../base/standard-update-compiler.js';
import type { StandardSqlSourceCompiler } from '../base/standard-sql-source-compiler.js';

export class MssqlUpdateCompiler implements SqlAstCompiler<UpdateQueryNode> {
  private readonly standardUpdate: StandardUpdateCompiler;

  constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {
    this.standardUpdate = new StandardUpdateCompiler(services, sources);
  }

  compile(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const target = this.sources.compileTableReference(ast.table);
    const assignments = this.standardUpdate.compileAssignments(ast.set, ast.table, ctx);
    const output = this.services.compileReturning(ast.returning, ctx);
    const from = ast.from ? ` FROM ${this.sources.compileFrom(ast.from, ctx)}` : '';
    const joins = ast.joins
      ? ast.joins
          .map(join => {
            const table = this.sources.compileFrom(join.table, ctx);
            const condition = this.services.compileExpression(join.condition, ctx);
            return ` ${join.kind} JOIN ${table} ON ${condition}`;
          })
          .join('')
      : '';
    const where = ast.where
      ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}`
      : '';
    return `UPDATE ${target} SET ${assignments}${output}${from}${joins}${where}`;
  }
}
