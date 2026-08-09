import type { ProcedureCallNode } from '../../ast/procedure.js';
import type {
  CompiledProcedureCall,
  ProcedureCompiler,
  ProcedureCompilerServices
} from '../capabilities/procedure-compiler.js';

export class PostgresProcedureCompiler implements ProcedureCompiler {
  constructor(private readonly services: ProcedureCompilerServices) {}

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.services.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.services.quoteIdentifier(ast.ref.schema)}.${this.services.quoteIdentifier(ast.ref.name)}`
      : this.services.quoteIdentifier(ast.ref.name);

    const args: string[] = [];
    for (const param of ast.params) {
      if (param.direction === 'out') continue;
      if (!param.value) {
        throw new Error(
          `Procedure parameter "${param.name}" requires a value for direction "${param.direction}".`
        );
      }
      args.push(this.services.compileOperand(param.value, ctx));
    }

    const outNames = ast.params
      .filter(param => param.direction === 'out' || param.direction === 'inout')
      .map(param => param.name);

    return {
      sql: `CALL ${qualifiedName}(${args.join(', ')});`,
      params: [...ctx.params],
      outParams: {
        source: outNames.length ? 'firstResultSet' : 'none',
        names: outNames
      }
    };
  }
}
