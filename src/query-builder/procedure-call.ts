import type { ProcedureCallNode, ProcedureParamNode } from '../core/ast/procedure.js';
import type { Dialect } from '../core/dialect/abstract.js';
import type { CompiledProcedureCall } from '../core/dialect/capabilities/procedure-compiler.js';
import { requireProcedureCompiler } from '../core/dialect/capabilities/procedure-compiler.js';
import { DialectKey, resolveDialectInput } from '../core/dialect/dialect-factory.js';
import { valueToOperand, ValueOperandInput } from '../core/ast/expression-builders.js';
import type { OrmSession } from '../orm/orm-session.js';
import { executeProcedureAst, type ProcedureExecutionResult } from '../orm/execute-procedure.js';

type ProcedureDialectInput = Dialect | DialectKey;

export interface CallProcedureOptions {
  schema?: string;
}

export interface ProcedureOutOptions {
  dbType?: string;
}

const cloneParam = (param: ProcedureParamNode): ProcedureParamNode => ({
  ...param,
  value: param.value ? { ...param.value } : undefined
});

export class ProcedureCallBuilder {
  private readonly ast: ProcedureCallNode;

  constructor(name: string, options?: CallProcedureOptions, ast?: ProcedureCallNode) {
    this.ast = ast ?? {
      type: 'ProcedureCall',
      ref: {
        name,
        schema: options?.schema
      },
      params: []
    };
  }

  private clone(nextParams: ProcedureParamNode[]): ProcedureCallBuilder {
    return new ProcedureCallBuilder(
      this.ast.ref.name,
      { schema: this.ast.ref.schema },
      {
        ...this.ast,
        ref: { ...this.ast.ref },
        params: nextParams
      }
    );
  }

  in(name: string, value: ValueOperandInput): ProcedureCallBuilder {
    return this.clone([
      ...this.ast.params.map(cloneParam),
      {
        name,
        direction: 'in',
        value: valueToOperand(value)
      }
    ]);
  }

  out(name: string, options?: ProcedureOutOptions): ProcedureCallBuilder {
    return this.clone([
      ...this.ast.params.map(cloneParam),
      {
        name,
        direction: 'out',
        dbType: options?.dbType
      }
    ]);
  }

  inOut(name: string, value: ValueOperandInput, options?: ProcedureOutOptions): ProcedureCallBuilder {
    return this.clone([
      ...this.ast.params.map(cloneParam),
      {
        name,
        direction: 'inout',
        value: valueToOperand(value),
        dbType: options?.dbType
      }
    ]);
  }

  compile(dialect: ProcedureDialectInput): CompiledProcedureCall {
    const resolved = resolveDialectInput(dialect);
    return requireProcedureCompiler(resolved).compileProcedureCall(this.getAST());
  }

  toSql(dialect: ProcedureDialectInput): string {
    return this.compile(dialect).sql;
  }

  getAST(): ProcedureCallNode {
    return {
      ...this.ast,
      ref: { ...this.ast.ref },
      params: this.ast.params.map(cloneParam)
    };
  }

  async execute(session: OrmSession): Promise<ProcedureExecutionResult> {
    return executeProcedureAst(session, this.getAST());
  }
}

export const callProcedure = (name: string, options?: CallProcedureOptions): ProcedureCallBuilder =>
  new ProcedureCallBuilder(name, options);
