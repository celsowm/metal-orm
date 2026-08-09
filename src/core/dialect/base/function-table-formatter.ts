import type { CompilerContext } from '../abstract.js';
import type { OperandNode } from '../../ast/expression.js';
import type { FunctionTableNode } from '../../ast/query.js';

export interface FunctionTableFormattingContext {
  quoteIdentifier(id: string): string;
  compileOperand(node: OperandNode, ctx: CompilerContext): string;
}

/**
 * Formats function-table expressions without depending on a dialect base class.
 * SQL compilers provide only the two operations this formatter actually needs.
 */
export class FunctionTableFormatter {
  static format(
    fn: FunctionTableNode,
    ctx: CompilerContext | undefined,
    formatter: FunctionTableFormattingContext
  ): string {
    const schemaPart = this.formatSchema(fn, formatter);
    const args = this.formatArgs(fn, ctx, formatter);
    const base = this.formatBase(fn, schemaPart, args);
    const lateral = this.formatLateral(fn);
    const alias = this.formatAlias(fn, formatter);
    const colAliases = this.formatColumnAliases(fn, formatter);
    return `${lateral}${base}${alias}${colAliases}`;
  }

  private static formatSchema(
    fn: FunctionTableNode,
    formatter: FunctionTableFormattingContext
  ): string {
    if (!fn.schema) return '';
    return `${formatter.quoteIdentifier(fn.schema)}.`;
  }

  private static formatArgs(
    fn: FunctionTableNode,
    ctx: CompilerContext | undefined,
    formatter: FunctionTableFormattingContext
  ): string {
    return (fn.args || [])
      .map((arg: OperandNode) => ctx ? formatter.compileOperand(arg, ctx) : String(arg))
      .join(', ');
  }

  private static formatBase(fn: FunctionTableNode, schemaPart: string, args: string): string {
    const ordinality = fn.withOrdinality ? ' WITH ORDINALITY' : '';
    return `${schemaPart}${fn.name}(${args})${ordinality}`;
  }

  private static formatLateral(fn: FunctionTableNode): string {
    return fn.lateral ? 'LATERAL ' : '';
  }

  private static formatAlias(
    fn: FunctionTableNode,
    formatter: FunctionTableFormattingContext
  ): string {
    if (!fn.alias) return '';
    return ` AS ${formatter.quoteIdentifier(fn.alias)}`;
  }

  private static formatColumnAliases(
    fn: FunctionTableNode,
    formatter: FunctionTableFormattingContext
  ): string {
    if (!fn.columnAliases || !fn.columnAliases.length) return '';
    const aliases = fn.columnAliases
      .map(col => formatter.quoteIdentifier(col))
      .join(', ');
    return `(${aliases})`;
  }
}
