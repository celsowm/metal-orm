import type { ProcedureCallNode } from '../../ast/procedure.js';
import type {
  CompiledProcedureCall,
  ProcedureCompiler,
  ProcedureCompilerServices
} from '../capabilities/procedure-compiler.js';

const sanitizeVariableSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

export class MySqlProcedureCompiler implements ProcedureCompiler {
  constructor(private readonly services: ProcedureCompilerServices) {}

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.services.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.services.quoteIdentifier(ast.ref.schema)}.${this.services.quoteIdentifier(ast.ref.name)}`
      : this.services.quoteIdentifier(ast.ref.name);

    const prelude: string[] = [];
    const callArgs: string[] = [];
    const outVars: Array<{ variable: string; name: string }> = [];

    ast.params.forEach((param, index) => {
      const suffix = sanitizeVariableSuffix(param.name || `p${index + 1}`);
      const variable = `@__metal_${suffix}_${index + 1}`;

      if (param.direction === 'in') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "in".`);
        }
        callArgs.push(this.services.compileOperand(param.value, ctx));
        return;
      }

      if (param.direction === 'inout') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "inout".`);
        }
        prelude.push(`SET ${variable} = ${this.services.compileOperand(param.value, ctx)};`);
      }

      callArgs.push(variable);
      outVars.push({ variable, name: param.name });
    });

    const statements: string[] = [];
    if (prelude.length) statements.push(...prelude);
    statements.push(`CALL ${qualifiedName}(${callArgs.join(', ')});`);

    if (outVars.length) {
      const selectOut = outVars
        .map(({ variable, name }) => `${variable} AS ${this.services.quoteIdentifier(name)}`)
        .join(', ');
      statements.push(`SELECT ${selectOut};`);
    }

    return {
      sql: statements.join(' '),
      params: [...ctx.params],
      outParams: {
        source: outVars.length ? 'lastResultSet' : 'none',
        names: outVars.map(item => item.name)
      }
    };
  }
}
