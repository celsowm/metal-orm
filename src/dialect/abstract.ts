import { SelectQueryNode } from '../ast/query';
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
} from '../ast/expression';

export interface CompilerContext {
  params: unknown[];
  addParameter(value: unknown): string;
}

export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

export abstract class Dialect {
  compileSelect(ast: SelectQueryNode): CompiledQuery {
    const ctx = this.createCompilerContext();
    const rawSql = this.compileSelectAst(ast, ctx).trim();
    const sql = rawSql.endsWith(';') ? rawSql : `${rawSql};`;
    return {
      sql,
      params: [...ctx.params]
    };
  }

  protected abstract compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;

  abstract quoteIdentifier(id: string): string;

  protected compileWhere(where: ExpressionNode | undefined, ctx: CompilerContext): string {
    if (!where) return '';
    return ` WHERE ${this.compileExpression(where, ctx)}`;
  }

  /**
   * Gera a subquery para EXISTS.
   * Regra: sempre força SELECT 1, ignorando a lista de colunas.
   * Mantém FROM, JOINs, WHERE, GROUP BY, ORDER BY, LIMIT/OFFSET.
   * Não adiciona ';' no final.
   */
  protected compileSelectForExists(ast: SelectQueryNode, ctx: CompilerContext): string {
    const full = this.compileSelectAst(ast, ctx).trim().replace(/;$/, '');
    const upper = full.toUpperCase();
    const fromIndex = upper.indexOf(' FROM ');
    if (fromIndex === -1) {
      return full;
    }

    const tail = full.slice(fromIndex);
    return `SELECT 1${tail}`;
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

  protected formatPlaceholder(index: number): string {
    return '?';
  }

  private readonly expressionCompilers: Map<string, (node: ExpressionNode, ctx: CompilerContext) => string>;
  private readonly operandCompilers: Map<string, (node: OperandNode, ctx: CompilerContext) => string>;

  protected constructor() {
    this.expressionCompilers = new Map();
    this.operandCompilers = new Map();
    this.registerDefaultOperandCompilers();
    this.registerDefaultExpressionCompilers();
  }

  protected registerExpressionCompiler<T extends ExpressionNode>(type: T['type'], compiler: (node: T, ctx: CompilerContext) => string): void {
    this.expressionCompilers.set(type, compiler as (node: ExpressionNode, ctx: CompilerContext) => string);
  }

  protected registerOperandCompiler<T extends OperandNode>(type: T['type'], compiler: (node: T, ctx: CompilerContext) => string): void {
    this.operandCompilers.set(type, compiler as (node: OperandNode, ctx: CompilerContext) => string);
  }

  protected compileExpression(node: ExpressionNode, ctx: CompilerContext): string {
    const compiler = this.expressionCompilers.get(node.type);
    return compiler ? compiler(node, ctx) : '';
  }

  protected compileOperand(node: OperandNode, ctx: CompilerContext): string {
    const compiler = this.operandCompilers.get(node.type);
    return compiler ? compiler(node, ctx) : '';
  }

  private registerDefaultExpressionCompilers(): void {
    this.registerExpressionCompiler('BinaryExpression', (binary: BinaryExpressionNode, ctx) => {
      const left = this.compileOperand(binary.left, ctx);
      const right = this.compileOperand(binary.right, ctx);
      return `${left} ${binary.operator} ${right}`;
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
