import type { CompilerContext } from '../abstract.js';
import type { InsertQueryNode } from '../../ast/query.js';
import type {
  UpsertCompilationServices,
  UpsertStrategy
} from '../base/upsert-strategy.js';

export class MySqlUpsertStrategy implements UpsertStrategy {
  compile(
    ast: InsertQueryNode,
    ctx: CompilerContext,
    services: UpsertCompilationServices
  ): string {
    if (!ast.onConflict) return '';

    const clause = ast.onConflict;
    if (clause.action.type === 'DoNothing') {
      const noOpColumn = clause.target.columns[0] ?? ast.columns[0];
      if (!noOpColumn) {
        throw new Error('MySQL ON DUPLICATE KEY UPDATE requires at least one target column.');
      }
      const col = services.quoteIdentifier(noOpColumn.name);
      return ` ON DUPLICATE KEY UPDATE ${col} = ${col}`;
    }

    if (clause.action.where) {
      throw new Error('MySQL ON DUPLICATE KEY UPDATE does not support a WHERE clause.');
    }
    if (!clause.action.set.length) {
      throw new Error('MySQL ON DUPLICATE KEY UPDATE requires at least one assignment.');
    }

    const assignments = clause.action.set
      .map(assignment => {
        const target = services.quoteIdentifier(assignment.column.name);
        const value = services.compileOperand(assignment.value, ctx);
        return `${target} = ${value}`;
      })
      .join(', ');
    return ` ON DUPLICATE KEY UPDATE ${assignments}`;
  }
}
