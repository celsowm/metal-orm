import type { CompilerContext } from '../abstract.js';
import type { OrderingTerm, SelectQueryNode } from '../../ast/query.js';
import {
  type ExpressionNode,
  type BinaryExpressionNode,
  type LogicalExpressionNode,
  type NotExpressionNode,
  type NullExpressionNode,
  type InExpressionNode,
  type ExistsExpressionNode,
  type LiteralNode,
  type ColumnNode,
  type OperandNode,
  type FunctionNode,
  type JsonPathNode,
  type ScalarSubqueryNode,
  type CaseExpressionNode,
  type CastExpressionNode,
  type WindowFunctionNode,
  type BetweenExpressionNode,
  type ArithmeticExpressionNode,
  type BitwiseExpressionNode,
  type CollateExpressionNode,
  type AliasRefNode,
  type IsDistinctExpressionNode,
  isOperandNode
} from '../../ast/expression.js';

export interface ExpressionCompilerHost {
  quoteIdentifier(id: string): string;
  compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string;
  compileSelectForExists(ast: SelectQueryNode, ctx: CompilerContext): string;
  compileJsonPath(node: JsonPathNode): string;
  compileFunctionOperand(node: FunctionNode, ctx: CompilerContext): string;
  describe(): string;
}

type ExpressionCompiler = (node: ExpressionNode, ctx: CompilerContext) => string;
type OperandCompiler = (node: OperandNode, ctx: CompilerContext) => string;

/**
 * Owns expression/operand dispatch independently from dialect query compilation.
 * Dialects can replace individual node compilers without inheriting a second AST
 * dispatcher or duplicating the default SQL expression behavior.
 */
export class ExpressionCompilerRegistry {
  private readonly expressionCompilers = new Map<string, ExpressionCompiler>();
  private readonly operandCompilers = new Map<string, OperandCompiler>();

  constructor(private readonly host: ExpressionCompilerHost) {
    this.registerDefaultOperandCompilers();
    this.registerDefaultExpressionCompilers();
  }

  registerExpressionCompiler<T extends ExpressionNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void {
    this.expressionCompilers.set(type, compiler as ExpressionCompiler);
  }

  registerOperandCompiler<T extends OperandNode>(
    type: T['type'],
    compiler: (node: T, ctx: CompilerContext) => string
  ): void {
    this.operandCompilers.set(type, compiler as OperandCompiler);
  }

  compileExpression(node: ExpressionNode, ctx: CompilerContext): string {
    const compiler = this.expressionCompilers.get(node.type);
    if (!compiler) {
      throw new Error(`Unsupported expression node type "${node.type}" for ${this.host.describe()}`);
    }
    return compiler(node, ctx);
  }

  compileOperand(node: OperandNode, ctx: CompilerContext): string {
    const compiler = this.operandCompilers.get(node.type);
    if (!compiler) {
      throw new Error(`Unsupported operand node type "${node.type}" for ${this.host.describe()}`);
    }
    return compiler(node, ctx);
  }

  compileOrderingTerm(term: OrderingTerm, ctx: CompilerContext): string {
    if (isOperandNode(term)) {
      return this.compileOperand(term, ctx);
    }
    return `(${this.compileExpression(term as ExpressionNode, ctx)})`;
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

    this.registerExpressionCompiler('NotExpression', (notExpr: NotExpressionNode, ctx) => {
      const operand = this.compileExpression(notExpr.operand, ctx);
      return `NOT (${operand})`;
    });

    this.registerExpressionCompiler('NullExpression', (nullExpr: NullExpressionNode, ctx) => {
      const left = this.compileOperand(nullExpr.left, ctx);
      return `${left} ${nullExpr.operator}`;
    });

    this.registerExpressionCompiler('InExpression', (inExpr: InExpressionNode, ctx) => {
      const left = this.compileOperand(inExpr.left, ctx);
      if (Array.isArray(inExpr.right)) {
        const values = inExpr.right.map(v => this.compileOperand(v, ctx)).join(', ');
        return `${left} ${inExpr.operator} (${values})`;
      }
      const subquerySql = this.host.compileSelectAst(inExpr.right.query, ctx).trim().replace(/;$/, '');
      return `${left} ${inExpr.operator} (${subquerySql})`;
    });

    this.registerExpressionCompiler('ExistsExpression', (existsExpr: ExistsExpressionNode, ctx) => {
      const subquerySql = this.host.compileSelectForExists(existsExpr.subquery, ctx);
      return `${existsExpr.operator} (${subquerySql})`;
    });

    this.registerExpressionCompiler('BetweenExpression', (betweenExpr: BetweenExpressionNode, ctx) => {
      const left = this.compileOperand(betweenExpr.left, ctx);
      const lower = this.compileOperand(betweenExpr.lower, ctx);
      const upper = this.compileOperand(betweenExpr.upper, ctx);
      return `${left} ${betweenExpr.operator} ${lower} AND ${upper}`;
    });

    this.registerExpressionCompiler('ArithmeticExpression', (arith: ArithmeticExpressionNode, ctx) => {
      const left = this.compileOperand(arith.left, ctx);
      const right = this.compileOperand(arith.right, ctx);
      return `${left} ${arith.operator} ${right}`;
    });

    this.registerExpressionCompiler('BitwiseExpression', (bitwise: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(bitwise.left, ctx);
      const right = this.compileOperand(bitwise.right, ctx);
      return `${left} ${bitwise.operator} ${right}`;
    });

    this.registerExpressionCompiler('IsDistinctExpression', (node: IsDistinctExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      return `${left} ${node.operator} ${right}`;
    });
  }

  private registerDefaultOperandCompilers(): void {
    this.registerOperandCompiler('Literal', (literal: LiteralNode, ctx) =>
      ctx.addParameter(literal.value)
    );

    this.registerOperandCompiler('AliasRef', (alias: AliasRefNode) =>
      this.host.quoteIdentifier(alias.name)
    );

    this.registerOperandCompiler('Column', (column: ColumnNode) =>
      `${this.host.quoteIdentifier(column.table)}.${this.host.quoteIdentifier(column.name)}`
    );

    this.registerOperandCompiler('Function', (fnNode: FunctionNode, ctx) =>
      this.host.compileFunctionOperand(fnNode, ctx)
    );

    this.registerOperandCompiler('JsonPath', (path: JsonPathNode) =>
      this.host.compileJsonPath(path)
    );

    this.registerOperandCompiler('ScalarSubquery', (node: ScalarSubqueryNode, ctx) => {
      const sql = this.host.compileSelectAst(node.query, ctx).trim().replace(/;$/, '');
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

    this.registerOperandCompiler('Cast', (node: CastExpressionNode, ctx) => {
      const value = this.compileOperand(node.expression, ctx);
      return `CAST(${value} AS ${node.castType})`;
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
          `${this.host.quoteIdentifier(col.table)}.${this.host.quoteIdentifier(col.name)}`
        ).join(', ');
        parts.push(partitionClause);
      }

      if (node.orderBy && node.orderBy.length > 0) {
        const orderClause = 'ORDER BY ' + node.orderBy.map(o => {
          const term = this.compileOrderingTerm(o.term, ctx);
          const collation = o.collation ? ` COLLATE ${o.collation}` : '';
          const nulls = o.nulls ? ` NULLS ${o.nulls}` : '';
          return `${term} ${o.direction}${collation}${nulls}`;
        }).join(', ');
        parts.push(orderClause);
      }

      result += parts.join(' ');
      result += ')';
      return result;
    });

    this.registerOperandCompiler('ArithmeticExpression', (node: ArithmeticExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      return `(${left} ${node.operator} ${right})`;
    });

    this.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      return `(${left} ${node.operator} ${right})`;
    });

    this.registerOperandCompiler('Collate', (node: CollateExpressionNode, ctx) => {
      const expr = this.compileOperand(node.expression, ctx);
      return `${expr} COLLATE ${node.collation}`;
    });
  }
}
