import { SelectQueryNode } from '../ast/query';
import { ExpressionNode, BinaryExpressionNode, LogicalExpressionNode, NullExpressionNode, InExpressionNode, ExistsExpressionNode, LiteralNode, ColumnNode, OperandNode, FunctionNode, JsonPathNode, ScalarSubqueryNode } from '../ast/expression';

export abstract class Dialect {
  abstract compileSelect(ast: SelectQueryNode): string;
  abstract quoteIdentifier(id: string): string;
  protected compileWhere(where?: ExpressionNode): string {
    if (!where) return '';
    return ` WHERE ${this.compileExpression(where)}`;
  }

  /**
   * Gera a subquery para EXISTS.
   * Regra: sempre força SELECT 1, ignorando a lista de colunas.
   * Mantém FROM, JOINs, WHERE, GROUP BY, ORDER BY, LIMIT/OFFSET.
   * Não adiciona ';' no final.
   */
  protected compileSelectForExists(ast: SelectQueryNode): string {
    // Usa a própria compileSelect e faz um rewrite simples de "SELECT ... FROM"
    const full = this.compileSelect(ast).trim().replace(/;$/, '');
    const upper = full.toUpperCase();
    const fromIndex = upper.indexOf(' FROM ');
    if (fromIndex === -1) {
      // fallback paranoico: se por algum motivo não achar, só devolve:
      return full;
    }

    const tail = full.slice(fromIndex); // " FROM ...."
    // Força SELECT 1
    return `SELECT 1${tail}`;
  }

  private readonly expressionCompilers: Map<string, (node: ExpressionNode) => string>;
  private readonly operandCompilers: Map<string, (node: OperandNode) => string>;

  protected constructor() {
    this.expressionCompilers = new Map();
    this.operandCompilers = new Map();
    this.registerDefaultOperandCompilers();
    this.registerDefaultExpressionCompilers();
  }

  protected registerExpressionCompiler<T extends ExpressionNode>(type: T['type'], compiler: (node: T) => string): void {
    this.expressionCompilers.set(type, compiler as (node: ExpressionNode) => string);
  }

  protected registerOperandCompiler<T extends OperandNode>(type: T['type'], compiler: (node: T) => string): void {
    this.operandCompilers.set(type, compiler as (node: OperandNode) => string);
  }

  protected compileExpression(node: ExpressionNode): string {
    const compiler = this.expressionCompilers.get(node.type);
    return compiler ? compiler(node) : '';
  }

  protected compileOperand(node: OperandNode): string {
    const compiler = this.operandCompilers.get(node.type);
    return compiler ? compiler(node) : '';
  }

  private registerDefaultExpressionCompilers(): void {
    this.registerExpressionCompiler('BinaryExpression', (binary: BinaryExpressionNode) => {
      const left = this.compileOperand(binary.left);
      const right = this.compileOperand(binary.right);
      return `${left} ${binary.operator} ${right}`;
    });

    this.registerExpressionCompiler('LogicalExpression', (logical: LogicalExpressionNode) => {
      if (logical.operands.length === 0) return '';
      const parts = logical.operands.map(op => {
        const compiled = this.compileExpression(op);
        return op.type === 'LogicalExpression' ? `(${compiled})` : compiled;
      });
      return parts.join(` ${logical.operator} `);
    });

    this.registerExpressionCompiler('NullExpression', (nullExpr: NullExpressionNode) => {
      const left = this.compileOperand(nullExpr.left);
      return `${left} ${nullExpr.operator}`;
    });

    this.registerExpressionCompiler('InExpression', (inExpr: InExpressionNode) => {
      const left = this.compileOperand(inExpr.left);
      const values = inExpr.right.map(v => this.compileOperand(v)).join(', ');
      return `${left} ${inExpr.operator} (${values})`;
    });

    this.registerExpressionCompiler('ExistsExpression', (existsExpr: ExistsExpressionNode) => {
      const subquerySql = this.compileSelectForExists(existsExpr.subquery);
      // compileSelectForExists NÃO coloca ';'
      return `${existsExpr.operator} (${subquerySql})`;
    });
  }

  private registerDefaultOperandCompilers(): void {
    this.registerOperandCompiler('Literal', (literal: LiteralNode) => {
      if (literal.value === null) return 'NULL';
      return typeof literal.value === 'string' ? `'${literal.value}'` : String(literal.value);
    });

    this.registerOperandCompiler('Column', (column: ColumnNode) => {
      return `${this.quoteIdentifier(column.table)}.${this.quoteIdentifier(column.name)}`;
    });

    this.registerOperandCompiler('Function', (fnNode: FunctionNode) => {
      const args = fnNode.args.map(arg => this.compileOperand(arg)).join(', ');
      return `${fnNode.name}(${args})`;
    });

    this.registerOperandCompiler('JsonPath', (path: JsonPathNode) => this.compileJsonPath(path));

    this.registerOperandCompiler('ScalarSubquery', (node: ScalarSubqueryNode) => {
      const sql = this.compileSelect(node.query).trim().replace(/;$/, '');
      return `(${sql})`;
    });
  }

  // Default fallback, should be overridden by dialects if supported
  protected compileJsonPath(node: JsonPathNode): string {
    throw new Error("JSON Path not supported by this dialect");
  }
}
