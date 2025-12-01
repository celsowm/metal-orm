import { ColumnNode, FunctionNode, ExpressionNode } from './expression';
import { JoinNode } from './join';

export interface TableNode {
  type: 'Table';
  name: string;
  schema?: string;
  alias?: string;
}

export interface OrderByNode {
    type: 'OrderBy';
    column: ColumnNode;
    direction: 'ASC' | 'DESC';
}

export interface SelectQueryNode {
  type: 'SelectQuery';
  from: TableNode;
  columns: (ColumnNode | FunctionNode)[];
  joins: JoinNode[];
  where?: ExpressionNode;
  groupBy?: ColumnNode[];
  orderBy?: OrderByNode[];
  limit?: number;
  offset?: number;
}