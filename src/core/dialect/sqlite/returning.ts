import type { ColumnNode } from '../../ast/expression.js';
import type { CompilerContext } from '../abstract.js';
import type {
  QuoteIdentifier,
  ReturningStrategy
} from '../base/returning-strategy.js';

export class SqliteReturningStrategy implements ReturningStrategy {
  compileReturning(
    returning: ColumnNode[] | undefined,
    _ctx: CompilerContext,
    quoteIdentifier: QuoteIdentifier
  ): string {
    void _ctx;
    if (!returning || returning.length === 0) return '';
    return ` RETURNING ${this.formatReturningColumns(returning, quoteIdentifier)}`;
  }

  formatReturningColumns(
    returning: ColumnNode[],
    quoteIdentifier: QuoteIdentifier
  ): string {
    return returning
      .map(column => {
        const alias = column.alias ? ` AS ${quoteIdentifier(column.alias)}` : '';
        return `${quoteIdentifier(column.name)}${alias}`;
      })
      .join(', ');
  }
}
