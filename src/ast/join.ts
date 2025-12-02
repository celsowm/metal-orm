import { TableNode } from './query';
import { ExpressionNode } from './expression';
import { JoinKind } from '../constants/sql';

export interface JoinNode {
  type: 'Join';
  kind: JoinKind;
  table: TableNode;
  condition: ExpressionNode;
  relationName?: string; // Metadata for code generation to reconstruct .joinRelation()
}
