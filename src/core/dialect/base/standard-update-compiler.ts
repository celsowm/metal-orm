import type { CompilerContext } from '../abstract.js';
import type { UpdateQueryNode, TableNode } from '../../ast/query.js';
import type { ColumnNode, OperandNode } from '../../ast/expression.js';
import { JoinCompiler } from './join-compiler.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/** Standard UPDATE orchestration, independent from concrete dialect classes. */
export class StandardUpdateCompiler {
  public constructor(
    private readonly services: StandardSqlCompilerServices,
    private readonly sources: StandardSqlSourceCompiler
  ) {}

  compile(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const target = this.sources.compileTableReference(ast.table);
    const assignments = this.compileAssignments(ast.set, ast.table, ctx);
    const from = this.compileFromClause(ast, ctx);
    const where = ast.where ? ` WHERE ${this.services.compileExpression(ast.where, ctx)}` : '';
    const returning = this.services.compileReturning(ast.returning, ctx);
    return `UPDATE ${target} SET ${assignments}${from}${where}${returning}`;
  }

  compileAssignments(
    assignments: { column: ColumnNode; value: OperandNode }[],
    table: TableNode,
    ctx: CompilerContext
  ): string {
    return assignments
      .map(assignment => {
        const target = this.services.compileSetTarget(assignment.column, table);
        const value = this.services.compileOperand(assignment.value, ctx);
        return `${target} = ${value}`;
      })
      .join(', ');
  }

  private compileFromClause(ast: UpdateQueryNode, ctx: CompilerContext): string {
    if (!ast.from && (!ast.joins || ast.joins.length === 0)) return '';
    if (!ast.from) {
      throw new Error('UPDATE with JOINs requires an explicit FROM clause.');
    }

    const from = this.sources.compileFrom(ast.from, ctx);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      (source, compilerContext) => this.sources.compileFrom(source, compilerContext),
      (expression, compilerContext) => this.services.compileExpression(expression, compilerContext)
    );
    return ` FROM ${from}${joins}`;
  }
}
