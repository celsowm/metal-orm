import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { JsonPathNode, IsDistinctExpressionNode } from '../../ast/expression.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { MysqlFunctionStrategy } from './functions.js';
import { MySqlProcedureCompiler } from './procedure-compiler.js';
import { MySqlUpsertStrategy } from './upsert.js';

/** MySQL dialect assembled from reusable compiler components. */
export class MySqlDialect extends SqlDialectBase implements ProcedureCompiler {
  protected readonly dialect = 'mysql';
  private readonly procedureCompiler: MySqlProcedureCompiler;

  public constructor() {
    super({
      functionStrategy: new MysqlFunctionStrategy(),
      upsertStrategy: new MySqlUpsertStrategy()
    });

    this.procedureCompiler = new MySqlProcedureCompiler({
      quoteIdentifier: id => this.quoteIdentifier(id),
      createCompilerContext: () => this.createCompilerContext(),
      compileOperand: (node, ctx) => this.compileOperand(node, ctx)
    });

    this.registerExpressionCompiler(
      'IsDistinctExpression',
      (node: IsDistinctExpressionNode, ctx): string => {
        const left = this.compileOperand(node.left, ctx);
        const right = this.compileOperand(node.right, ctx);
        const spaceship = `${left} <=> ${right}`;
        return node.operator === 'IS NOT DISTINCT FROM'
          ? spaceship
          : `NOT (${spaceship})`;
      }
    );
  }

  quoteIdentifier(id: string): string {
    return `\`${id}\``;
  }

  protected compileJsonPath(node: JsonPathNode): string {
    const column = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    return `${column}->'${node.path}'`;
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    return this.procedureCompiler.compileProcedureCall(ast);
  }
}
