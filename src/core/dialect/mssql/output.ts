import type { ColumnNode } from '../../ast/expression.js';
import type { CompilerContext } from '../abstract.js';
import type {
  QuoteIdentifier,
  ReturningStrategy
} from '../base/returning-strategy.js';

export type MssqlOutputPrefix = 'inserted' | 'deleted';

export class MssqlOutputStrategy implements ReturningStrategy {
  compileReturning(
    returning: ColumnNode[] | undefined,
    _ctx: CompilerContext,
    quoteIdentifier: QuoteIdentifier
  ): string {
    void _ctx;
    return this.compileOutput(returning, 'inserted', quoteIdentifier);
  }

  compileOutput(
    returning: ColumnNode[] | undefined,
    prefix: MssqlOutputPrefix,
    quoteIdentifier: QuoteIdentifier
  ): string {
    if (!returning || returning.length === 0) return '';
    const columns = returning
      .map(column => {
        const alias = column.alias ? ` AS ${quoteIdentifier(column.alias)}` : '';
        return `${prefix}.${quoteIdentifier(column.name)}${alias}`;
      })
      .join(', ');
    return ` OUTPUT ${columns}`;
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
