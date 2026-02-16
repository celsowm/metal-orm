import { CompilerContext, CompiledProcedureCall } from '../abstract.js';
import { JsonPathNode, ColumnNode, BitwiseExpressionNode } from '../../ast/expression.js';
import { TableNode } from '../../ast/query.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { PostgresFunctionStrategy } from './functions.js';
import { PostgresTableFunctionStrategy } from './table-functions.js';
import { ProcedureCallNode } from '../../ast/procedure.js';

/**
 * PostgreSQL dialect implementation
 */
export class PostgresDialect extends SqlDialectBase {
  protected readonly dialect = 'postgres';
  /**
   * Creates a new PostgresDialect instance
   */
  public constructor() {
    super(new PostgresFunctionStrategy(), new PostgresTableFunctionStrategy());
    this.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      const op = node.operator === '^' ? '#' : node.operator;
      return `${left} ${op} ${right}`;
    });
    this.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      const op = node.operator === '^' ? '#' : node.operator;
      return `(${left} ${op} ${right})`;
    });
  }

  /**
   * Quotes an identifier using PostgreSQL double-quote syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  protected formatPlaceholder(index: number): string {
    return `$${index}`;
  }

  /**
   * Compiles JSON path expression using PostgreSQL syntax
   * @param node - JSON path node
   * @returns PostgreSQL JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // Postgres uses col->>'path' for text extraction
    return `${col}->>'${node.path}'`;
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    void ctx;
    if (!returning || returning.length === 0) return '';
    const columns = this.formatReturningColumns(returning);
    return ` RETURNING ${columns}`;
  }

  supportsDmlReturningClause(): boolean {
    return true;
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.quoteIdentifier(ast.ref.schema)}.${this.quoteIdentifier(ast.ref.name)}`
      : this.quoteIdentifier(ast.ref.name);

    const args: string[] = [];
    for (const param of ast.params) {
      if (param.direction === 'out') continue;
      if (!param.value) {
        throw new Error(`Procedure parameter "${param.name}" requires a value for direction "${param.direction}".`);
      }
      args.push(this.compileOperand(param.value, ctx));
    }

    const outNames = ast.params
      .filter(param => param.direction === 'out' || param.direction === 'inout')
      .map(param => param.name);

    const rawSql = `CALL ${qualifiedName}(${args.join(', ')})`;
    return {
      sql: `${rawSql};`,
      params: [...ctx.params],
      outParams: {
        source: outNames.length ? 'firstResultSet' : 'none',
        names: outNames
      }
    };
  }

  /**
   * PostgreSQL requires unqualified column names in SET clause
   */
  protected compileSetTarget(column: ColumnNode, _table: TableNode): string {
    return this.quoteIdentifier(column.name);
  }
}
