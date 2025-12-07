import { CompilerContext } from '../abstract.js';
import { SqlDialectBase } from './sql-dialect.js';

export interface FunctionTableNode {
  type: 'FunctionTable';
  schema?: string;
  name: string;
  args?: unknown[];
  lateral?: boolean;
  withOrdinality?: boolean;
  alias?: string;
  columnAliases?: string[];
}

/**
 * Formatter for function table expressions (e.g., LATERAL unnest(...) WITH ORDINALITY).
 * Encapsulates logic for generating SQL function table syntax including LATERAL, aliases, and column lists.
 */
export class FunctionTableFormatter {
  /**
   * Formats a function table node into SQL syntax.
   * @param fn - The function table node containing schema, name, args, and aliases.
   * @param ctx - Optional compiler context for operand compilation.
   * @param dialect - The dialect instance for compiling operands.
   * @returns SQL function table expression (e.g., "LATERAL schema.func(args) WITH ORDINALITY AS alias(col1, col2)").
   */
  static format(fn: FunctionTableNode, ctx?: CompilerContext, dialect?: SqlDialectBase): string {
    const schemaPart = this.formatSchema(fn, dialect);
    const args = this.formatArgs(fn, ctx, dialect);
    const base = this.formatBase(fn, schemaPart, args, dialect);
    const lateral = this.formatLateral(fn);
    const alias = this.formatAlias(fn, dialect);
    const colAliases = this.formatColumnAliases(fn, dialect);
    return `${lateral}${base}${alias}${colAliases}`;
  }

  /**
   * Formats the schema prefix for the function name.
   * @param fn - The function table node.
   * @param dialect - The dialect instance for quoting identifiers.
   * @returns Schema prefix (e.g., "schema.") or empty string.
   * @internal
   */
  private static formatSchema(fn: FunctionTableNode, dialect?: SqlDialectBase): string {
    if (!fn.schema) return '';
    const quoted = dialect ? dialect.quoteIdentifier(fn.schema) : fn.schema;
    return `${quoted}.`;
  }

  /**
   * Formats function arguments into SQL syntax.
   * @param fn - The function table node containing arguments.
   * @param ctx - Optional compiler context for operand compilation.
   * @param dialect - The dialect instance for compiling operands.
   * @returns Comma-separated function arguments.
   * @internal
   */
  private static formatArgs(fn: FunctionTableNode, ctx?: CompilerContext, dialect?: SqlDialectBase): string {
    return (fn.args || [])
      .map((a: any) => {
        if (ctx && dialect) {
          return (dialect as any).compileOperand(a, ctx);
        }
        return String(a);
      })
      .join(', ');
  }

  /**
   * Formats the base function call with WITH ORDINALITY if present.
   * @param fn - The function table node.
   * @param schemaPart - Formatted schema prefix.
   * @param args - Formatted function arguments.
   * @param dialect - The dialect instance for quoting identifiers.
   * @returns Base function call expression (e.g., "schema.func(args) WITH ORDINALITY").
   * @internal
   */
  private static formatBase(fn: FunctionTableNode, schemaPart: string, args: string, dialect?: SqlDialectBase): string {
    const ordinality = fn.withOrdinality ? ' WITH ORDINALITY' : '';
    const quoted = dialect ? dialect.quoteIdentifier(fn.name) : fn.name;
    return `${schemaPart}${quoted}(${args})${ordinality}`;
  }

  /**
   * Formats the LATERAL keyword if present.
   * @param fn - The function table node.
   * @returns "LATERAL " or empty string.
   * @internal
   */
  private static formatLateral(fn: FunctionTableNode): string {
    return fn.lateral ? 'LATERAL ' : '';
  }

  /**
   * Formats the table alias for the function table.
   * @param fn - The function table node.
   * @param dialect - The dialect instance for quoting identifiers.
   * @returns " AS alias" or empty string.
   * @internal
   */
  private static formatAlias(fn: FunctionTableNode, dialect?: SqlDialectBase): string {
    if (!fn.alias) return '';
    const quoted = dialect ? dialect.quoteIdentifier(fn.alias) : fn.alias;
    return ` AS ${quoted}`;
  }

  /**
   * Formats column aliases for the function table result columns.
   * @param fn - The function table node containing column aliases.
   * @param dialect - The dialect instance for quoting identifiers.
   * @returns "(col1, col2, ...)" or empty string.
   * @internal
   */
  private static formatColumnAliases(fn: FunctionTableNode, dialect?: SqlDialectBase): string {
    if (!fn.columnAliases || !fn.columnAliases.length) return '';
    const aliases = fn.columnAliases
      .map(col => dialect ? dialect.quoteIdentifier(col) : col)
      .join(', ');
    return `(${aliases})`;
  }
}

export interface FunctionTableNode {
  type: 'FunctionTable';
  schema?: string;
  name: string;
  args?: unknown[];
  lateral?: boolean;
  withOrdinality?: boolean;
  alias?: string;
  columnAliases?: string[];
}
