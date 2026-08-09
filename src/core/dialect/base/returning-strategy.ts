import type { ColumnNode } from '../../ast/expression.js';
import type { CompilerContext } from '../abstract.js';

export type QuoteIdentifier = (id: string) => string;

/** Backend-specific RETURNING/OUTPUT rendering strategy. */
export interface ReturningStrategy {
  compileReturning(
    returning: ColumnNode[] | undefined,
    ctx: CompilerContext,
    quoteIdentifier: QuoteIdentifier
  ): string;

  formatReturningColumns(
    returning: ColumnNode[],
    quoteIdentifier: QuoteIdentifier
  ): string;
}

/** Default RETURNING strategy for dialects without support. */
export class NoReturningStrategy implements ReturningStrategy {
  compileReturning(
    returning: ColumnNode[] | undefined,
    _ctx: CompilerContext,
    _quoteIdentifier: QuoteIdentifier
  ): string {
    void _ctx;
    void _quoteIdentifier;
    if (!returning || returning.length === 0) return '';
    throw new Error('RETURNING is not supported by this dialect.');
  }

  formatReturningColumns(
    returning: ColumnNode[],
    quoteIdentifier: QuoteIdentifier
  ): string {
    return returning
      .map(column => {
        const tablePart = column.table ? `${quoteIdentifier(column.table)}.` : '';
        const aliasPart = column.alias ? ` AS ${quoteIdentifier(column.alias)}` : '';
        return `${tablePart}${quoteIdentifier(column.name)}${aliasPart}`;
      })
      .join(', ');
  }
}

/** Standard SQL RETURNING implementation with qualified column support. */
export class StandardReturningStrategy extends NoReturningStrategy {
  override compileReturning(
    returning: ColumnNode[] | undefined,
    _ctx: CompilerContext,
    quoteIdentifier: QuoteIdentifier
  ): string {
    void _ctx;
    if (!returning || returning.length === 0) return '';
    return ` RETURNING ${this.formatReturningColumns(returning, quoteIdentifier)}`;
  }
}
