import type { CompilerContext } from '../abstract.js';
import type { InsertQueryNode } from '../../ast/query.js';
import type {
  UpsertCompilationServices,
  UpsertStrategy
} from '../base/upsert-strategy.js';

export class PostgresUpsertStrategy implements UpsertStrategy {
  compile(
    ast: InsertQueryNode,
    ctx: CompilerContext,
    services: UpsertCompilationServices
  ): string {
    if (!ast.onConflict) return '';

    const clause = ast.onConflict;
    const target = clause.target.constraint
      ? ` ON CONFLICT ON CONSTRAINT ${services.quoteIdentifier(clause.target.constraint)}`
      : (() => {
          if (!clause.target.columns.length) {
            throw new Error('PostgreSQL ON CONFLICT requires conflict columns or a constraint name.');
          }
          const columns = clause.target.columns
            .map(column => services.quoteIdentifier(column.name))
            .join(', ');
          return ` ON CONFLICT (${columns})`;
        })();

    if (clause.action.type === 'DoNothing') {
      return `${target} DO NOTHING`;
    }

    if (!clause.action.set.length) {
      throw new Error('PostgreSQL ON CONFLICT DO UPDATE requires at least one assignment.');
    }

    const assignments = services.compileUpdateAssignments(clause.action.set, ast.into, ctx);
    const where = clause.action.where
      ? ` WHERE ${services.compileExpression(clause.action.where, ctx)}`
      : '';
    return `${target} DO UPDATE SET ${assignments}${where}`;
  }
}
