import type { ProcedureCallNode } from '../../ast/procedure.js';
import type {
  CompiledProcedureCall,
  ProcedureCompiler,
  ProcedureCompilerServices
} from '../capabilities/procedure-compiler.js';

const sanitizeVariableSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

const toProcedureParamReference = (value: string): string =>
  value.startsWith('@') ? value : `@${value}`;

export class MssqlProcedureCompiler implements ProcedureCompiler {
  constructor(private readonly services: ProcedureCompilerServices) {}

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.services.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.services.quoteIdentifier(ast.ref.schema)}.${this.services.quoteIdentifier(ast.ref.name)}`
      : this.services.quoteIdentifier(ast.ref.name);

    const declarations: string[] = [];
    const assignments: string[] = [];
    const execArgs: string[] = [];
    const outVars: Array<{ variable: string; name: string }> = [];

    ast.params.forEach((param, index) => {
      const targetParam = toProcedureParamReference(param.name);
      if (param.direction === 'in') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "in".`);
        }
        execArgs.push(`${targetParam} = ${this.services.compileOperand(param.value, ctx)}`);
        return;
      }

      if (!param.dbType) {
        throw new Error(
          `MSSQL procedure parameter "${param.name}" requires "dbType" for direction "${param.direction}".`
        );
      }

      const suffix = sanitizeVariableSuffix(param.name || `p${index + 1}`);
      const variable = `@__metal_${suffix}_${index + 1}`;
      declarations.push(`DECLARE ${variable} ${param.dbType};`);

      if (param.direction === 'inout') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "inout".`);
        }
        assignments.push(`SET ${variable} = ${this.services.compileOperand(param.value, ctx)};`);
      }

      execArgs.push(`${targetParam} = ${variable} OUTPUT`);
      outVars.push({ variable, name: param.name });
    });

    const statements: string[] = [];
    if (declarations.length) statements.push(...declarations);
    if (assignments.length) statements.push(...assignments);
    const argsSql = execArgs.length ? ` ${execArgs.join(', ')}` : '';
    statements.push(`EXEC ${qualifiedName}${argsSql};`);

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
