import type { CompilerContext } from '../abstract.js';
import type { InsertQueryNode } from '../../ast/query.js';
import type {
  UpsertCompilationServices,
  UpsertStrategy
} from '../base/upsert-strategy.js';

export class SqliteUpsertStrategy implements UpsertStrategy {
  compile(
    ast: InsertQueryNode,
    ctx: CompilerContext,
    services: UpsertCompilationServices
  ): string {
    if (!ast.onConflict) return '';

    const clause = ast.onConflict;
    if (clause.target.constraint) {
      throw new Error('SQLite ON CONFLICT does not support named constraints.');
    }
    if (!clause.target.columns.length) {
      throw new Error('SQLite ON CONFLICT requires conflict columns.');
    }

    const columns = clause.target.columns
      .map(column => services.quoteIdentifier(column.name))
      .join(', ');
    const target = ` ON CONFLICT (${columns})`;

    if (clause.action.type === 'DoNothing') {
      return `${target} DO NOTHING`;
    }

    if (!clause.action.set.length) {
      throw new Error('SQLite ON CONFLICT DO UPDATE requires at least one assignment.');
    }

    const assignments = services.compileUpdateAssignments(clause.action.set, ast.into, ctx);
    const where = clause.action.where
      ? ` WHERE ${services.compileExpression(clause.action.where, ctx)}`
      : '';
    return `${target} DO UPDATE SET ${assignments}${where}`;
  }
}
