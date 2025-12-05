import {
  SelectQueryNode,
  InsertQueryNode,
  UpdateQueryNode,
  DeleteQueryNode,
  SetOperationKind,
  CommonTableExpressionNode
} from '../ast/query.js';
import {
  ExpressionNode,
  BinaryExpressionNode,
  LogicalExpressionNode,
  NullExpressionNode,
  InExpressionNode,
  ExistsExpressionNode,
  LiteralNode,
  ColumnNode,
  OperandNode,
  FunctionNode,
  JsonPathNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode,
  BetweenExpressionNode
} from '../ast/expression.js';

/**
 * Context for SQL compilation with parameter management
 */
export interface CompilerContext {
  /** Array of parameters */
  params: unknown[];
  /** Function to add a parameter and get its placeholder */
  addParameter(value: unknown): string;
}

/**
 * Result of SQL compilation
 */
export interface CompiledQuery {
  /** Generated SQL string */
  sql: string;
  /** Parameters for the query */
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
 * Abstract base class for SQL dialect implementations
 */
export abstract class Dialect
  implements SelectCompiler, InsertCompiler, UpdateCompiler, DeleteCompiler
{
  /**
   * Compiles a SELECT query AST to SQL
   * @param ast - Query AST to compile
   * @returns Compiled query with SQL and parameters
   */
  compileSelect(ast: SelectQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const normalized = this.normalizeSelectAst(ast);
    const rawSql = this.compileSelectAst(normalized, ctx).trim();
    const sql = rawSql.endsWith(';') ? rawSql : `${rawSql};`;
    return {
      sql,
      params: [...ctx.params]
    };
  }

  compileInsert(ast: InsertQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileInsertAst(ast, ctx).trim();
    const sql = rawSql.endsWith(';') ? rawSql : `${rawSql};`;
    return {
      sql,
      params: [...ctx.params]
    };
  }

  compileUpdate(ast: UpdateQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileUpdateAst(ast, ctx).trim();
    const sql = rawSql.endsWith(';') ? rawSql : `${rawSql};`;
    return {
      sql,
      params: [...ctx.params]
    };
  }

  compileDelete(ast: DeleteQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileDeleteAst(ast, ctx).trim();
    const sql = rawSql.endsWith(';') ? rawSql : `${rawSql};`;
    return {
      sql,
      params: [...ctx.params]
    };
  }

  supportsReturning(): boolean {
    return false;
  }

  /**
   * Compiles SELECT query AST to SQL (to be implemented by concrete dialects)
   * @param ast - Query AST
   * @param ctx - Compiler context
   * @returns SQL string
   */
  protected abstract compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;

  protected abstract compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string;
  protected abstract compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string;
  protected abstract compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string;

  /**
   * Quotes an SQL identifier (to be implemented by concrete dialects)
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  abstract quoteIdentifier(id: string): string;

  /**
   * Compiles a WHERE clause
   * @param where - WHERE expression
   * @param ctx - Compiler context
   * @returns SQL WHERE clause or empty string
   */
  protected compileWhere(where: ExpressionNode | undefined, ctx: CompilerContext): string {
    if (!where) return '';
    return ` WHERE ${this.compileExpression(where, ctx)}`;
  }

  protected compileReturning(
    returning: ColumnNode[] | undefined,
    ctx: CompilerContext
  ): string {
    if (!returning || returning.length === 0) return '';
    throw new Error('RETURNING is not supported by this dialect.');
  }

  /**
   * Generates subquery for EXISTS expressions
   * Rule: Always forces SELECT 1, ignoring column list
   * Maintains FROM, JOINs, WHERE, GROUP BY, ORDER BY, LIMIT/OFFSET
   * Does not add ';' at the end
   * @param ast - Query AST
   * @param ctx - Compiler context
   * @returns SQL for EXISTS subquery
   */
  protected compileSelectForExists(ast: SelectQueryNode, ctx: CompilerContext): string {
    const normalized = this.normalizeSelectAst(ast);
    const full = this.compileSelectAst(normalized, ctx).trim().replace(/;$/, '');
    const upper = full.toUpperCase();
    const fromIndex = upper.indexOf(' FROM ');
    if (fromIndex === -1) {
      return full;
    }

    const tail = full.slice(fromIndex);
    return `SELECT 1${tail}`;
  }

  /**
   * Creates a new compiler context
   * @returns Compiler context with parameter management
   */
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

  /**
   * Formats a parameter placeholder
   * @param index - Parameter index
   * @returns Formatted placeholder string
   */
  protected formatPlaceholder(index: number): string {
    return '?';
  }

  /**
   * Whether the current dialect supports a given set operation.
   * Override in concrete dialects to restrict support.
   */
  protected supportsSetOperation(kind: SetOperationKind): boolean {
    return true;
  }

  /**
   * Validates set-operation semantics:
   * - Ensures the dialect supports requested operators.
   * - Enforces that only the outermost compound query may have ORDER/LIMIT/OFFSET.
   * @param ast - Query to validate
   * @param isOutermost - Whether this node is the outermost compound query
   */
  protected validateSetOperations(ast: SelectQueryNode, isOutermost = true): void {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    if (!isOutermost && (ast.orderBy || ast.limit !== undefined || ast.offset !== undefined)) {
      throw new Error('ORDER BY / LIMIT / OFFSET are only allowed on the outermost compound query.');
    }

    if (hasSetOps) {
      for (const op of ast.setOps!) {
        if (!this.supportsSetOperation(op.operator)) {
          throw new Error(`Set operation ${op.operator} is not supported by this dialect.`);
        }
        this.validateSetOperations(op.query, false);
      }
    }
  }

  /**
   * Hoists CTEs from set-operation operands to the outermost query so WITH appears once.
   * @param ast - Query AST
   * @returns Normalized AST without inner CTEs and a list of hoisted CTEs
   */
  private hoistCtes(ast: SelectQueryNode): { normalized: SelectQueryNode; hoistedCtes: CommonTableExpressionNode[] } {
    let hoisted: CommonTableExpressionNode[] = [];

    const normalizedSetOps = ast.setOps?.map(op => {
      const { normalized: child, hoistedCtes: childHoisted } = this.hoistCtes(op.query);
      const childCtes = child.ctes ?? [];
      if (childCtes.length) {
        hoisted = hoisted.concat(childCtes);
      }
      hoisted = hoisted.concat(childHoisted);
      const queryWithoutCtes = childCtes.length ? { ...child, ctes: undefined } : child;
      return { ...op, query: queryWithoutCtes };
    });

    const normalized: SelectQueryNode = normalizedSetOps ? { ...ast, setOps: normalizedSetOps } : ast;
    return { normalized, hoistedCtes: hoisted };
  }

  /**
   * Normalizes a SELECT AST before compilation (validation + CTE hoisting).
   * @param ast - Query AST
   * @returns Normalized query AST
   */
  protected normalizeSelectAst(ast: SelectQueryNode): SelectQueryNode {
    this.validateSetOperations(ast, true);
    const { normalized, hoistedCtes } = this.hoistCtes(ast);
    const combinedCtes = [...(normalized.ctes ?? []), ...hoistedCtes];
    return combinedCtes.length ? { ...normalized, ctes: combinedCtes } : normalized;
  }

  private readonly expressionCompilers: Map<string, (node: ExpressionNode, ctx: CompilerContext) => string>;
  private readonly operandCompilers: Map<string, (node: OperandNode, ctx: CompilerContext) => string>;

  protected constructor() {
    this.expressionCompilers = new Map();
    this.operandCompilers = new Map();
    this.registerDefaultOperandCompilers();
    this.registerDefaultExpressionCompilers();
  }

  /**
   * Registers an expression compiler for a specific node type
   * @param type - Expression node type
   * @param compiler - Compiler function
   */
  protected registerExpressionCompiler<T extends ExpressionNode>(type: T['type'], compiler: (node: T, ctx: CompilerContext) => string): void {
    this.expressionCompilers.set(type, compiler as (node: ExpressionNode, ctx: CompilerContext) => string);
  }

  /**
   * Registers an operand compiler for a specific node type
   * @param type - Operand node type
   * @param compiler - Compiler function
   */
  protected registerOperandCompiler<T extends OperandNode>(type: T['type'], compiler: (node: T, ctx: CompilerContext) => string): void {
    this.operandCompilers.set(type, compiler as (node: OperandNode, ctx: CompilerContext) => string);
  }

  /**
   * Compiles an expression node
   * @param node - Expression node to compile
   * @param ctx - Compiler context
   * @returns Compiled SQL expression
   */
  protected compileExpression(node: ExpressionNode, ctx: CompilerContext): string {
    const compiler = this.expressionCompilers.get(node.type);
    if (!compiler) {
      throw new Error(`Unsupported expression node type "${node.type}" for ${this.constructor.name}`);
    }
    return compiler(node, ctx);
  }

  /**
   * Compiles an operand node
   * @param node - Operand node to compile
   * @param ctx - Compiler context
   * @returns Compiled SQL operand
   */
  protected compileOperand(node: OperandNode, ctx: CompilerContext): string {
    const compiler = this.operandCompilers.get(node.type);
    if (!compiler) {
      throw new Error(`Unsupported operand node type "${node.type}" for ${this.constructor.name}`);
    }
    return compiler(node, ctx);
  }

  private registerDefaultExpressionCompilers(): void {
    this.registerExpressionCompiler('BinaryExpression', (binary: BinaryExpressionNode, ctx) => {
      const left = this.compileOperand(binary.left, ctx);
      const right = this.compileOperand(binary.right, ctx);
      const base = `${left} ${binary.operator} ${right}`;
      if (binary.escape) {
        const escapeOperand = this.compileOperand(binary.escape, ctx);
        return `${base} ESCAPE ${escapeOperand}`;
      }
      return base;
    });

    this.registerExpressionCompiler('LogicalExpression', (logical: LogicalExpressionNode, ctx) => {
      if (logical.operands.length === 0) return '';
      const parts = logical.operands.map(op => {
        const compiled = this.compileExpression(op, ctx);
        return op.type === 'LogicalExpression' ? `(${compiled})` : compiled;
      });
      return parts.join(` ${logical.operator} `);
    });

    this.registerExpressionCompiler('NullExpression', (nullExpr: NullExpressionNode, ctx) => {
      const left = this.compileOperand(nullExpr.left, ctx);
      return `${left} ${nullExpr.operator}`;
    });

    this.registerExpressionCompiler('InExpression', (inExpr: InExpressionNode, ctx) => {
      const left = this.compileOperand(inExpr.left, ctx);
      const values = inExpr.right.map(v => this.compileOperand(v, ctx)).join(', ');
      return `${left} ${inExpr.operator} (${values})`;
    });

    this.registerExpressionCompiler('ExistsExpression', (existsExpr: ExistsExpressionNode, ctx) => {
      const subquerySql = this.compileSelectForExists(existsExpr.subquery, ctx);
      return `${existsExpr.operator} (${subquerySql})`;
    });

    this.registerExpressionCompiler('BetweenExpression', (betweenExpr: BetweenExpressionNode, ctx) => {
      const left = this.compileOperand(betweenExpr.left, ctx);
      const lower = this.compileOperand(betweenExpr.lower, ctx);
      const upper = this.compileOperand(betweenExpr.upper, ctx);
      return `${left} ${betweenExpr.operator} ${lower} AND ${upper}`;
    });
  }

  private registerDefaultOperandCompilers(): void {
    this.registerOperandCompiler('Literal', (literal: LiteralNode, ctx) => ctx.addParameter(literal.value));

    this.registerOperandCompiler('Column', (column: ColumnNode, _ctx) => {
      return `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`;
    });
    this.registerOperandCompiler('Function', (fnNode: FunctionNode, ctx) => {
      const args = fnNode.args.map(arg => this.compileOperand(arg, ctx)).join(', ');
      return `${fnNode.name}(${args})`;
    });
    this.registerOperandCompiler('JsonPath', (path: JsonPathNode, _ctx) => this.compileJsonPath(path));

    this.registerOperandCompiler('ScalarSubquery', (node: ScalarSubqueryNode, ctx) => {
      const sql = this.compileSelectAst(node.query, ctx).trim().replace(/;$/, '');
      return `(${sql})`;
    });

    this.registerOperandCompiler('CaseExpression', (node: CaseExpressionNode, ctx) => {
      const parts = ['CASE'];
      for (const { when, then } of node.conditions) {
        parts.push(`WHEN ${this.compileExpression(when, ctx)} THEN ${this.compileOperand(then, ctx)}`);
      }
      if (node.else) {
        parts.push(`ELSE ${this.compileOperand(node.else, ctx)}`);
      }
      parts.push('END');
      return parts.join(' ');
    });

    this.registerOperandCompiler('WindowFunction', (node: WindowFunctionNode, ctx) => {
      let result = `${node.name}(`;
      if (node.args.length > 0) {
        result += node.args.map(arg => this.compileOperand(arg, ctx)).join(', ');
      }
      result += ') OVER (';

      const parts: string[] = [];

      if (node.partitionBy && node.partitionBy.length > 0) {
        const partitionClause = 'PARTITION BY ' + node.partitionBy.map(col =>
          `${this.quoteIdentifier(col.table)}.${this.quoteIdentifier(col.name)}`
        ).join(', ');
        parts.push(partitionClause);
      }

      if (node.orderBy && node.orderBy.length > 0) {
        const orderClause = 'ORDER BY ' + node.orderBy.map(o =>
          `${this.quoteIdentifier(o.column.table)}.${this.quoteIdentifier(o.column.name)} ${o.direction}`
        ).join(', ');
        parts.push(orderClause);
      }

      result += parts.join(' ');
      result += ')';

      return result;
    });
  }

  // Default fallback, should be overridden by dialects if supported
  protected compileJsonPath(node: JsonPathNode): string {
    throw new Error("JSON Path not supported by this dialect");
  }
}
