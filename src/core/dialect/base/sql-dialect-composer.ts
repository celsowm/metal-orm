import type {
  DeleteQueryNode,
  InsertQueryNode,
  OrderByNode,
  OrderingTerm,
  SelectQueryNode,
  SetOperationKind,
  TableNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  JsonPathNode,
  OperandNode
} from '../../ast/expression.js';
import type { FunctionStrategy } from '../../functions/types.js';
import { StandardFunctionStrategy } from '../../functions/standard-strategy.js';
import type { TableFunctionStrategy } from '../../functions/table-types.js';
import { StandardTableFunctionStrategy } from '../../functions/standard-table-strategy.js';
import type { CompilerContext, Dialect } from '../abstract.js';
import type { ProcedureCompilerServices } from '../capabilities/procedure-compiler.js';
import { ExpressionCompilerRegistry } from './expression-compiler-registry.js';
import { SelectAstNormalizer } from './select-ast-normalizer.js';
import { StandardLimitOffsetPagination } from './pagination-strategy.js';
import type { PaginationStrategy } from './pagination-strategy.js';
import { NoReturningStrategy } from './returning-strategy.js';
import type { ReturningStrategy } from './returning-strategy.js';
import { NoUpsertStrategy } from './upsert-strategy.js';
import type { UpsertStrategy } from './upsert-strategy.js';
import { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';
import { StandardSelectCompiler } from './standard-select-compiler.js';
import { StandardInsertCompiler } from './standard-insert-compiler.js';
import { StandardUpdateCompiler } from './standard-update-compiler.js';
import { StandardDeleteCompiler } from './standard-delete-compiler.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';
import type { SqlCompilerFactory, SqlCompilerSet } from './sql-compiler-set.js';

export interface SqlDialectExpressionApi {
  registerExpressionCompiler<T extends ExpressionNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void;
  registerOperandCompiler<T extends OperandNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void;
  compileExpression(node: ExpressionNode, ctx: CompilerContext): string;
  compileOperand(node: OperandNode, ctx: CompilerContext): string;
  compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string;
}

export interface SqlDialectRuntimeServices extends ProcedureCompilerServices {
  compileExpression(node: ExpressionNode, ctx: CompilerContext): string;
  compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string;
  normalizeSelectAst(ast: SelectQueryNode): SelectQueryNode;
  compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;
}

export interface SqlDialectComposition {
  dialect: Dialect;
  runtime: SqlDialectRuntimeServices;
}

export interface SqlDialectConfig {
  /** Human-readable/backend identifier used by diagnostics and strategies. */
  name: string;
  quoteIdentifier(id: string): string;
  formatPlaceholder?(index: number): string;
  compileJsonPath?(node: JsonPathNode): string;
  functionStrategy?: FunctionStrategy;
  tableFunctionStrategy?: TableFunctionStrategy;
  paginationStrategy?: PaginationStrategy;
  returningStrategy?: ReturningStrategy;
  upsertStrategy?: UpsertStrategy;
  compilerFactory?: SqlCompilerFactory;
  supportsDmlReturning?: boolean;
  supportsSetOperation?(kind: SetOperationKind): boolean;
  compileSetTarget?(column: ColumnNode, table: TableNode): string;
  renderOrderByNulls?(order: OrderByNode): string | undefined;
  renderOrderByCollation?(order: OrderByNode): string | undefined;
  configureExpressions?(api: SqlDialectExpressionApi): void;
  describe?: string;
}

const terminate = (sql: string): string => {
  const trimmed = sql.trim();
  return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
};

/**
 * Assembles a full SQL dialect from independent compiler components.
 * No inheritance or concrete dialect class participates in the compilation path.
 */
export const composeSqlDialect = (config: SqlDialectConfig): SqlDialectComposition => {
  const functionStrategy = config.functionStrategy ?? new StandardFunctionStrategy();
  const tableFunctionStrategy = config.tableFunctionStrategy ?? new StandardTableFunctionStrategy();
  const paginationStrategy = config.paginationStrategy ?? new StandardLimitOffsetPagination();
  const returningStrategy = config.returningStrategy ?? new NoReturningStrategy();
  const upsertStrategy = config.upsertStrategy ?? new NoUpsertStrategy();
  const selectAstNormalizer = new SelectAstNormalizer(
    kind => config.supportsSetOperation?.(kind) ?? true
  );

  let compilerSet!: SqlCompilerSet;
  let expressionRegistry!: ExpressionCompilerRegistry;

  const createCompilerContext = (): CompilerContext => {
    const params: unknown[] = [];
    let counter = 0;
    return {
      params,
      addParameter(value: unknown): string {
        counter += 1;
        params.push(value);
        return config.formatPlaceholder?.(counter) ?? '?';
      }
    };
  };

  const compileSelectAst = (ast: SelectQueryNode, ctx: CompilerContext): string =>
    compilerSet.select.compile(ast, ctx);

  const normalizeSelectAst = (ast: SelectQueryNode): SelectQueryNode =>
    selectAstNormalizer.normalize(ast);

  const compileSelectForExists = (ast: SelectQueryNode, ctx: CompilerContext): string => {
    const normalized = normalizeSelectAst(ast);
    const full = compileSelectAst(normalized, ctx).trim().replace(/;$/, '');
    if (normalized.setOps && normalized.setOps.length > 0) {
      return `SELECT 1 FROM (${full}) AS _exists`;
    }
    const fromIndex = full.toUpperCase().indexOf(' FROM ');
    return fromIndex === -1 ? full : `SELECT 1${full.slice(fromIndex)}`;
  };

  const compileJsonPath = (node: JsonPathNode): string => {
    if (!config.compileJsonPath) {
      throw new Error(`JSON Path not supported by dialect "${config.name}".`);
    }
    return config.compileJsonPath(node);
  };

  const compileFunctionOperand = (node: FunctionNode, ctx: CompilerContext): string => {
    const compiledArgs = node.args.map(arg => expressionRegistry.compileOperand(arg, ctx));
    const renderer = functionStrategy.getRenderer(node.name);
    if (renderer) {
      return renderer({
        node,
        compiledArgs,
        compileOperand: operand => expressionRegistry.compileOperand(operand, ctx)
      });
    }
    return `${node.name}(${compiledArgs.join(', ')})`;
  };

  expressionRegistry = new ExpressionCompilerRegistry({
    quoteIdentifier: config.quoteIdentifier,
    compileSelectAst,
    compileSelectForExists,
    compileJsonPath,
    compileFunctionOperand,
    describe: () => config.describe ?? config.name
  });

  const compileSetTarget = (column: ColumnNode, table: TableNode): string => {
    if (config.compileSetTarget) return config.compileSetTarget(column, table);
    const columnTable = column.table ?? table.alias ?? table.name;
    const tableQualifier = table.alias && column.table === table.name
      ? table.alias
      : columnTable;
    return tableQualifier
      ? `${config.quoteIdentifier(tableQualifier)}.${config.quoteIdentifier(column.name)}`
      : config.quoteIdentifier(column.name);
  };

  let standardUpdate!: StandardUpdateCompiler;
  const services: StandardSqlCompilerServices = {
    getDialectName: () => config.name,
    getPaginationStrategy: () => paginationStrategy,
    getTableFunctionStrategy: () => tableFunctionStrategy,
    quoteIdentifier: config.quoteIdentifier,
    compileOperand: (node, ctx) => expressionRegistry.compileOperand(node, ctx),
    compileExpression: (node, ctx) => expressionRegistry.compileExpression(node, ctx),
    compileOrderingTerm: (term, ctx) => expressionRegistry.compileOrderingTerm(term, ctx),
    normalizeSelectAst: normalizeSelectAst,
    compileSelectAst,
    compileReturning: (returning, ctx) =>
      returningStrategy.compileReturning(returning, ctx, config.quoteIdentifier),
    compileUpsertClause: (ast, ctx) =>
      upsertStrategy.compile(ast, ctx, {
        getDialectName: () => config.name,
        quoteIdentifier: config.quoteIdentifier,
        compileOperand: (node, compilerContext) =>
          expressionRegistry.compileOperand(node, compilerContext),
        compileExpression: (node, compilerContext) =>
          expressionRegistry.compileExpression(node, compilerContext),
        compileUpdateAssignments: (assignments, table, compilerContext) =>
          standardUpdate.compileAssignments(assignments, table, compilerContext)
      }),
    compileSetTarget,
    renderOrderByNulls: order =>
      config.renderOrderByNulls?.(order) ?? (order.nulls ? ` NULLS ${order.nulls}` : ''),
    renderOrderByCollation: order =>
      config.renderOrderByCollation?.(order) ?? (order.collation ? ` COLLATE ${order.collation}` : '')
  };

  const sources = new StandardSqlSourceCompiler(services);
  const standardSelect = new StandardSelectCompiler(services, sources);
  const standardInsert = new StandardInsertCompiler(services, sources);
  standardUpdate = new StandardUpdateCompiler(services, sources);
  const standardDelete = new StandardDeleteCompiler(services, sources);
  const overrides = config.compilerFactory?.({ services, sources }) ?? {};
  compilerSet = {
    select: overrides.select ?? standardSelect,
    insert: overrides.insert ?? standardInsert,
    update: overrides.update ?? standardUpdate,
    delete: overrides.delete ?? standardDelete
  };

  const expressionApi: SqlDialectExpressionApi = {
    registerExpressionCompiler<T extends ExpressionNode>(
      type: T['type'],
      compiler: (node: T, ctx: CompilerContext) => string
    ): void {
      expressionRegistry.registerExpressionCompiler(type, compiler);
    },
    registerOperandCompiler<T extends OperandNode>(
      type: T['type'],
      compiler: (node: T, ctx: CompilerContext) => string
    ): void {
      expressionRegistry.registerOperandCompiler(type, compiler);
    },
    compileExpression(node: ExpressionNode, ctx: CompilerContext): string {
      return expressionRegistry.compileExpression(node, ctx);
    },
    compileOperand(node: OperandNode, ctx: CompilerContext): string {
      return expressionRegistry.compileOperand(node, ctx);
    },
    compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string {
      return expressionRegistry.compileOrderingTerm(term, ctx);
    }
  };
  config.configureExpressions?.(expressionApi);

  const dialect: Dialect = {
    quoteIdentifier: config.quoteIdentifier,
    supportsDmlReturningClause: () => config.supportsDmlReturning ?? false,
    compileSelect(ast: SelectQueryNode) {
      const ctx = createCompilerContext();
      return {
        sql: terminate(compileSelectAst(normalizeSelectAst(ast), ctx)),
        params: [...ctx.params]
      };
    },
    compileInsert(ast: InsertQueryNode) {
      const ctx = createCompilerContext();
      return {
        sql: terminate(compilerSet.insert.compile(ast, ctx)),
        params: [...ctx.params]
      };
    },
    compileUpdate(ast: UpdateQueryNode) {
      const ctx = createCompilerContext();
      return {
        sql: terminate(compilerSet.update.compile(ast, ctx)),
        params: [...ctx.params]
      };
    },
    compileDelete(ast: DeleteQueryNode) {
      const ctx = createCompilerContext();
      return {
        sql: terminate(compilerSet.delete.compile(ast, ctx)),
        params: [...ctx.params]
      };
    }
  };

  const runtime: SqlDialectRuntimeServices = {
    quoteIdentifier: config.quoteIdentifier,
    createCompilerContext,
    compileOperand: (node, ctx) => expressionRegistry.compileOperand(node, ctx),
    compileExpression: (node, ctx) => expressionRegistry.compileExpression(node, ctx),
    compileOrderingTerm: (term, ctx) => expressionRegistry.compileOrderingTerm(term, ctx),
    normalizeSelectAst: normalizeSelectAst,
    compileSelectAst
  };

  return { dialect, runtime };
};

export const createSqlDialect = (config: SqlDialectConfig): Dialect =>
  composeSqlDialect(config).dialect;
