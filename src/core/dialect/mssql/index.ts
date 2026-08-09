import type { ProcedureCallNode } from '../../ast/procedure.js';
import type { JsonPathNode } from '../../ast/expression.js';
import type { CompiledProcedureCall, ProcedureCompiler } from '../capabilities/procedure-compiler.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { MssqlFunctionStrategy } from './functions.js';
import { createMssqlCompilerSet } from './compiler-factory.js';
import { MssqlOutputStrategy } from './output.js';
import { MssqlProcedureCompiler } from './procedure-compiler.js';

/** Microsoft SQL Server dialect assembled from backend compiler components. */
export class SqlServerDialect extends SqlDialectBase implements ProcedureCompiler {
  protected readonly dialect = 'mssql';
  private readonly procedureCompiler: MssqlProcedureCompiler;

  public constructor() {
    super({
      functionStrategy: new MssqlFunctionStrategy(),
      returningStrategy: new MssqlOutputStrategy(),
      compilerFactory: createMssqlCompilerSet,
      supportsDmlReturning: true
    });

    this.procedureCompiler = new MssqlProcedureCompiler({
      quoteIdentifier: id => this.quoteIdentifier(id),
      createCompilerContext: () => this.createCompilerContext(),
      compileOperand: (node, ctx) => this.compileOperand(node, ctx)
    });
  }

  quoteIdentifier(id: string): string {
    return `[${id}]`;
  }

  protected compileJsonPath(node: JsonPathNode): string {
    const column = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    return `JSON_VALUE(${column}, '${node.path}')`;
  }

  protected formatPlaceholder(index: number): string {
    return `@p${index}`;
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    return this.procedureCompiler.compileProcedureCall(ast);
  }
}
