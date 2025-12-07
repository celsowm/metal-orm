import { ColumnNode } from '../../ast/expression.js';
import { CompilerContext } from '../abstract.js';

/**
 * Strategy interface for handling RETURNING clauses in DML statements (INSERT, UPDATE, DELETE).
 * Different SQL dialects have varying levels of support for RETURNING clauses.
 */
export interface ReturningStrategy {
  /**
   * Compiles a RETURNING clause for DML statements.
   * @param returning - Array of columns to return, or undefined if none.
   * @param ctx - The compiler context for expression compilation.
   * @returns SQL RETURNING clause or empty string if not supported.
   * @throws Error if RETURNING is not supported by this dialect.
   */
  compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string;
  /**
   * Formats column list for RETURNING clause.
   * @param returning - Array of columns to format.
   * @param quoteIdentifier - Function to quote identifiers according to dialect rules.
   * @returns Formatted column list (e.g., "table.col1, table.col2").
   */
  formatReturningColumns(returning: ColumnNode[], quoteIdentifier: (id: string) => string): string;
}

/**
 * Default RETURNING strategy that throws an error when RETURNING is used.
 * Use this for dialects that don't support RETURNING clauses.
 */
export class NoReturningStrategy implements ReturningStrategy {
  /**
   * Throws an error as RETURNING is not supported.
   * @param returning - Columns to return (causes error if non-empty).
   * @param _ctx - Compiler context (unused).
   * @throws Error indicating RETURNING is not supported.
   */
  compileReturning(returning: ColumnNode[] | undefined, _ctx: CompilerContext): string {
    if (!returning || returning.length === 0) return '';
    throw new Error('RETURNING is not supported by this dialect.');
  }
  /**
   * Formats column names for RETURNING clause.
   * @param returning - Columns to format.
   * @param quoteIdentifier - Function to quote identifiers according to dialect rules.
   * @returns Simple comma-separated column names.
   */
  formatReturningColumns(returning: ColumnNode[], quoteIdentifier: (id: string) => string): string {
    return returning
      .map(column => {
        const tablePart = column.table ? `${quoteIdentifier(column.table)}.` : '';
        const aliasPart = column.alias ? ` AS ${quoteIdentifier(column.alias)}` : '';
        return `${tablePart}${quoteIdentifier(column.name)}${aliasPart}`;
      })
      .join(', ');
  }
}
