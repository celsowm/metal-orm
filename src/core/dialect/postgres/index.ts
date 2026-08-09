import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { BitwiseExpressionNode, ColumnNode, JsonPathNode } from '../../ast/expression.js';
import type { TableNode } from '../../ast/query.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { PostgresFunctionStrategy } from './functions.js';
import { PostgresTableFunctionStrategy } from './table-functions.js';
import { PostgresProcedureCompiler } from './procedure-compiler.js';
import { PostgresReturningStrategy } from './returning.js';
import { PostgresUpsertStrategy } from './upsert.js';

/** PostgreSQL dialect assembled from reusable compiler components. */
export class PostgresDialect extends SqlDialectBase implements ProcedureCompiler {
  protected readonly dialect = 'postgres';
  private readonly procedureCompiler: PostgresProcedureCompiler;

  public constructor() {
    super({
      functionStrategy: new PostgresFunctionStrategy(),
      tableFunctionStrategy: new PostgresTableFunctionStrategy(),
      returningStrategy: new PostgresReturningStrategy(),
      upsertStrategy: new PostgresUpsertStrategy(),
      supportsDmlReturning: true
    });

    this.procedureCompiler = new PostgresProcedureCompiler({
      quoteIdentifier: id => this.quoteIdentifier(id),
      createCompilerContext: () => this.createCompilerContext(),
      compileOperand: (node, ctx) => this.compileOperand(node, ctx)
    });

    this.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      const operator = node.operator === '^' ? '#' : node.operator;
      return `${left} ${operator} ${right}`;
    });
    this.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      const operator = node.operator === '^' ? '#' : node.operator;
      return `(${left} ${operator} ${right})`;
    });
  }

  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  protected formatPlaceholder(index: number): string {
    return `$${index}`;
  }

  protected compileJsonPath(node: JsonPathNode): string {
    const column = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    return `${column}->>'${node.path}'`;
  }

  /** PostgreSQL requires unqualified column names in SET clauses. */
  protected compileSetTarget(column: ColumnNode, _table: TableNode): string {
    void _table;
    return this.quoteIdentifier(column.name);
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    return this.procedureCompiler.compileProcedureCall(ast);
  }
}
