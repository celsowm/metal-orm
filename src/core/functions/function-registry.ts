import { DialectName } from '../sql/sql.js';
import { FunctionNode } from '../ast/expression.js';

export interface FunctionRendererArgs {
  node: FunctionNode;
  compiledArgs: string[];
  dialect: DialectName;
  name: string;
}

export type FunctionRenderer = (args: FunctionRendererArgs) => string;

export interface FunctionDialectVariant {
  /** Optional name override for this dialect */
  name?: string;
  /** Custom renderer for this dialect */
  render?: FunctionRenderer;
  /** Explicit availability toggle (set to false to throw) */
  available?: boolean;
}

export interface SqlFunctionDefinition {
  /** Canonical function key (upper-case) */
  key: string;
  /** Default name to use when no dialect override exists */
  defaultName?: string;
  /** Generic renderer used when there is no dialect-specific renderer */
  render?: FunctionRenderer;
  /** Dialect-specific overrides */
  variants?: Partial<Record<DialectName, FunctionDialectVariant>>;
}

export interface FunctionRegistry {
  register(definition: SqlFunctionDefinition): void;
  render(node: FunctionNode, compiledArgs: string[], dialect: DialectName): string | undefined;
  isRegistered(key: string): boolean;
}

export class InMemoryFunctionRegistry implements FunctionRegistry {
  private readonly registry = new Map<string, SqlFunctionDefinition>();

  register(definition: SqlFunctionDefinition): void {
    const key = definition.key.toUpperCase();
    if (this.registry.has(key)) {
      throw new Error(`Function ${key} is already registered`);
    }
    this.registry.set(key, { ...definition, key });
  }

  render(node: FunctionNode, compiledArgs: string[], dialect: DialectName): string | undefined {
    const key = (node.fn ?? node.name).toUpperCase();
    const def = this.registry.get(key);
    if (!def) return undefined;

    const variant = def.variants?.[dialect];
    if (variant?.available === false) {
      throw new Error(`Function ${key} is not supported for dialect ${dialect}`);
    }

    const name = variant?.name ?? def.defaultName ?? def.key;
    const renderer = variant?.render ?? def.render;
    if (renderer) {
      return renderer({ node, compiledArgs, dialect, name });
    }

    return `${name}(${compiledArgs.join(', ')})`;
  }

  isRegistered(key: string): boolean {
    return this.registry.has(key.toUpperCase());
  }
}
