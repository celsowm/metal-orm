import { ColumnDef } from '../../schema/column';
import { ColumnNode, FunctionNode } from './expression-nodes';
import { columnOperand } from './expression-builders';

const buildAggregate = (name: string) => (col: ColumnDef | ColumnNode): FunctionNode => ({
  type: 'Function',
  name,
  args: [columnOperand(col)]
});

/**
 * Creates a COUNT function expression
 * @param col - Column to count
 * @returns Function node with COUNT
 */
export const count = buildAggregate('COUNT');

/**
 * Creates a SUM function expression
 * @param col - Column to sum
 * @returns Function node with SUM
 */
export const sum = buildAggregate('SUM');

/**
 * Creates an AVG function expression
 * @param col - Column to average
 * @returns Function node with AVG
 */
export const avg = buildAggregate('AVG');
