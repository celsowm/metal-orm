import type {
  SelectQueryNode,
  InsertQueryNode,
  UpdateQueryNode,
  DeleteQueryNode,
  SetOperationKind,
  OrderingTerm
} from '../ast/query.js';
import type {
  ExpressionNode,
  ColumnNode,
  OperandNode,
  FunctionNode,
  JsonPathNode
} from '../ast/expression.js';
import type { DialectName } from '../sql/sql.js';
import type { FunctionStrategy } from '../functions/types.js';
import { StandardFunctionStrategy } from '../functions/standard-strategy.js';
import type { TableFunctionStrategy } from '../functions/table-types.js';
import { StandardTableFunctionStrategy } from '../functions/standard-table-strategy.js';
import { ExpressionCompilerRegistry } from './base/expression-compiler-registry.js';
import { SelectAstNormalizer } from './base/select-ast-normalizer.js';

/** Context for SQL compilation with parameter management. */
export interface CompilerContext {
  params: unknown[];
  addParameter(value: unknown): string;
}

/** Result of SQL compilation. */
export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

export interface SelectCompiler {
  compileSelect(ast: SelectQueryNode): CompiledQuery;
}

export interface InsertCompiler {
  compileInsert(ast: InsertQueryNode): CompiledQuery;
}

export interface UpdateCompiler {
  compileUpdate(ast: UpdateQueryNode): CompiledQuery;
}

export interface DeleteCompiler {
  compileDelete(ast: DeleteQueryNode): CompiledQuery;
}

/**
 * Public dialect contract consumed by builders and the ORM runtime.
 * Optional backend features such as stored procedures live in dedicated
 * capability interfaces; mutation-wide behavior shared by the runtime stays
 * in this small core contract.
 */
export interface Dialect
  extends SelectCompiler, InsertCompiler, UpdateCompiler, DeleteCompiler {
  quoteIdentifier(id: string): string;
  supportsDmlReturningClause(): boolean;
}

/**
 * Shared implementation infrastructure for SQL dialects.
 *
 * This is deliberately separate from the public Dialect contract: custom
 * dialects may extend this class, extend SqlDialectBase, or use composition.
 */
export abstract class DialectBase implements Dialect {
  protected abstract readonly dialect: DialectName;

  private readonly expressionCompilerRegistry: ExpressionCompilerRegistry;
  private readonly selectAstNormalizer: SelectAstNormalizer;
  protected readonly functionStrategy: FunctionStrategy;
  protected readonly tableFunctionStrategy: TableFunctionStrategy;

  protected constructor(
    functionStrategy?: FunctionStrategy,
    tableFunctionStrategy?: TableFunctionStrategy
  ) {
    this.functionStrategy = functionStrategy ?? new StandardFunctionStrategy();
    this.tableFunctionStrategy = tableFunctionStrategy ?? new StandardTableFunctionStrategy();
    this.selectAstNormalizer = new SelectAstNormalizer(kind => this.supportsSetOperation(kind));
    this.expressionCompilerRegistry = new ExpressionCompilerRegistry({
      quoteIdentifier: id => this.quoteIdentifier(id),
      compileSelectAst: (ast, ctx) => this.compileSelectAst(ast, ctx),
      compileSelectForExists: (ast, ctx) => this.compileSelectForExists(ast, ctx),
      compileJsonPath: node => this.compileJsonPath(node),
      compileFunctionOperand: (node, ctx) => this.compileFunctionOperand(node, ctx),
      describe: () => this.constructor.name
    });
  }

  compileSelect(ast: SelectQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const normalized = this.normalizeSelectAst(ast);
    const rawSql = this.compileSelectAst(normalized, ctx).trim();
    return {
      sql: rawSql.endsWith(';') ? rawSql : `${rawSql};`,
      params: [...ctx.params]
    };
  }

  compileInsert(ast: InsertQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileInsertAst(ast, ctx).trim();
    return {
      sql: rawSql.endsWith(';') ? rawSql : `${rawSql};`,
      params: [...ctx.params]
    };
  }

  compileUpdate(ast: UpdateQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileUpdateAst(ast, ctx).trim();
    return {
      sql: rawSql.endsWith(';') ? rawSql : `${rawSql};`,
      params: [...ctx.params]
    };
  }

  compileDelete(ast: DeleteQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileDeleteAst(ast, ctx).trim();
    return {
      sql: rawSql.endsWith(';') ? rawSql : `${rawSql};`,
      params: [...ctx.params]
    };
  }

  supportsDmlReturningClause(): boolean {
    return false;
  }

  protected abstract compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;
  protected abstract compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string;
  protected abstract compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string;
  protected abstract compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string;

  abstract quoteIdentifier(id: string): string;

  protected compileWhere(where: ExpressionNode | undefined, ctx: CompilerContext): string {
    if (!where) return '';
    return ` WHERE ${this.compileExpression(where, ctx)}`;
  }

  protected compileReturning(
    returning: ColumnNode[] | undefined,
    _ctx: CompilerContext
  ): string {
    void _ctx;
    if (!returning || returning.length === 0) return '';
    throw new Error('RETURNING is not supported by this dialect.');
  }

  protected compileSelectForExists(ast: SelectQueryNode, ctx: CompilerContext): string {
    const normalized = this.normalizeSelectAst(ast);
    const full = this.compileSelectAst(normalized, ctx).trim().replace(/;$/, '');

    if (normalized.setOps && normalized.setOps.length > 0) {
      return `SELECT 1 FROM (${full}) AS _exists`;
    }

    const upper = full.toUpperCase();
    const fromIndex = upper.indexOf(' FROM ');
    if (fromIndex === -1) return full;

    return `SELECT 1${full.slice(fromIndex)}`;
  }

  protected createCompilerContext(): CompilerContext {
    const params: unknown[] = [];
    let counter = 0;
    return {
      params,
      addParameter: (value: unknown) => {
        counter += 1;
        params.push(value);
        return this.formatPlaceholder(counter);
      }
    };
  }

  protected formatPlaceholder(_index: number): string {
    void _index;
    return '?';
  }

  protected supportsSetOperation(_kind: SetOperationKind): boolean {
    void _kind;
    return true;
  }

  protected normalizeSelectAst(ast: SelectQueryNode): SelectQueryNode {
    return this.selectAstNormalizer.normalize(ast);
  }

  protected registerExpressionCompiler<T extends ExpressionNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void {
    this.expressionCompilerRegistry.registerExpressionCompiler(type, compiler);
  }

  protected registerOperandCompiler<T extends OperandNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void {
    this.expressionCompilerRegistry.registerOperandCompiler(type, compiler);
  }

  protected compileExpression(node: ExpressionNode, ctx: CompilerContext): string {
    return this.expressionCompilerRegistry.compileExpression(node, ctx);
  }

  protected compileOperand(node: OperandNode, ctx: CompilerContext): string {
    return this.expressionCompilerRegistry.compileOperand(node, ctx);
  }

  protected compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string {
    return this.expressionCompilerRegistry.compileOrderingTerm(term, ctx);
  }

  protected compileJsonPath(_node: JsonPathNode): string {
    void _node;
    throw new Error('JSON Path not supported by this dialect');
  }

  protected compileFunctionOperand(fnNode: FunctionNode, ctx: CompilerContext): string {
    const compiledArgs = fnNode.args.map(arg => this.compileOperand(arg, ctx));
    const renderer = this.functionStrategy.getRenderer(fnNode.name);
    if (renderer) {
      return renderer({
        node: fnNode,
        compiledArgs,
        compileOperand: operand => this.compileOperand(operand, ctx)
      });
    }
    return `${fnNode.name}(${compiledArgs.join(', ')})`;
  }

  /** Creates a minimal dialect implementation for isolated compiler tests. */
  static create(
    functionStrategy?: FunctionStrategy,
    tableFunctionStrategy?: TableFunctionStrategy
  ): Dialect {
    class TestDialect extends DialectBase {
      protected readonly dialect: DialectName = 'sqlite';
      quoteIdentifier(id: string): string {
        return `"${id}"`;
      }
      protected compileSelectAst(): never {
        throw new Error('Not implemented');
      }
      protected compileInsertAst(): never {
        throw new Error('Not implemented');
      }
      protected compileUpdateAst(): never {
        throw new Error('Not implemented');
      }
      protected compileDeleteAst(): never {
        throw new Error('Not implemented');
      }
    }
    return new TestDialect(functionStrategy, tableFunctionStrategy);
  }
}
