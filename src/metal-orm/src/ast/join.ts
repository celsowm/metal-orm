import { TableNode } from './query';
import { BinaryExpressionNode } from './expression';

export interface JoinNode {
  type: 'Join';
  kind: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
  table: TableNode;
  condition: BinaryExpressionNode;
  relationName?: string; // Metadata for code generation to reconstruct .joinRelation()
}