import type { OperandNode } from './expression.js';

export type ProcedureDirection = 'in' | 'out' | 'inout';

export interface ProcedureRefNode {
  name: string;
  schema?: string;
}

export interface ProcedureParamNode {
  name: string;
  direction: ProcedureDirection;
  value?: OperandNode;
  dbType?: string;
}

export interface ProcedureCallNode {
  type: 'ProcedureCall';
  ref: ProcedureRefNode;
  params: ProcedureParamNode[];
}
