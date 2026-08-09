import type { CompilerContext } from '../abstract.js';
import type {
  DerivedTableNode,
  FunctionTableNode,
  TableSourceNode
} from '../../ast/query.js';
import { FunctionTableFormatter } from './function-table-formatter.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';

/** Shared FROM/table-source rendering used by the standard query compilers. */
export class StandardSqlSourceCompiler {
  public constructor(private readonly services: StandardSqlCompilerServices) {}

  compileFrom(source: TableSourceNode, ctx?: CompilerContext): string {
    if (source.type === 'FunctionTable') return this.compileFunctionTable(source, ctx);
    if (source.type === 'DerivedTable') return this.compileDerivedTable(source, ctx);
    return this.compileTableSource(source);
  }

  compileFunctionTable(fn: FunctionTableNode, ctx?: CompilerContext): string {
    const key = fn.key ?? fn.name;

    if (ctx) {
      const renderer = this.services.getTableFunctionStrategy().getRenderer(key);
      if (renderer) {
        const compiledArgs = (fn.args ?? []).map(arg => this.services.compileOperand(arg, ctx));
        return renderer({
          node: fn,
          compiledArgs,
          compileOperand: operand => this.services.compileOperand(operand, ctx),
          quoteIdentifier: id => this.services.quoteIdentifier(id)
        });
      }

      if (fn.key) {
        throw new Error(
          `Table function "${key}" is not supported by dialect "${this.services.getDialectName()}".`
        );
      }
    }

    return FunctionTableFormatter.format(fn, ctx, {
      quoteIdentifier: id => this.services.quoteIdentifier(id),
      compileOperand: (node, compilerContext) => this.services.compileOperand(node, compilerContext)
    });
  }

  compileDerivedTable(table: DerivedTableNode, ctx?: CompilerContext): string {
    if (!table.alias) throw new Error('Derived tables must have an alias.');
    if (!ctx) throw new Error('Derived table compilation requires a compiler context.');

    const normalized = this.services.normalizeSelectAst(table.query);
    const subquery = this.services.compileSelectAst(normalized, ctx).trim().replace(/;$/, '');
    const columns = table.columnAliases?.length
      ? ` (${table.columnAliases.map(column => this.services.quoteIdentifier(column)).join(', ')})`
      : '';
    return `(${subquery}) AS ${this.services.quoteIdentifier(table.alias)}${columns}`;
  }

  compileTableSource(table: TableSourceNode): string {
    if (table.type === 'FunctionTable') return this.compileFunctionTable(table);
    if (table.type === 'DerivedTable') {
      throw new Error('Derived table compilation requires a compiler context.');
    }
    const base = this.compileTableName(table);
    return table.alias ? `${base} AS ${this.services.quoteIdentifier(table.alias)}` : base;
  }

  compileTableName(table: { name: string; schema?: string }): string {
    if (table.schema) {
      return `${this.services.quoteIdentifier(table.schema)}.${this.services.quoteIdentifier(table.name)}`;
    }
    return this.services.quoteIdentifier(table.name);
  }

  compileTableReference(table: { name: string; schema?: string; alias?: string }): string {
    const base = this.compileTableName(table);
    return table.alias ? `${base} AS ${this.services.quoteIdentifier(table.alias)}` : base;
  }

  stripTrailingSemicolon(sql: string): string {
    return sql.trim().replace(/;$/, '');
  }

  wrapSetOperand(sql: string): string {
    return `(${this.stripTrailingSemicolon(sql)})`;
  }
}
