import { TableNode } from './query';
import { ExpressionNode } from './expression';

export interface JoinNode {
  type: 'Join';
  kind: 'INNER' | 'LEFT' | 'RIGHT' | 'CROSS';
  table: TableNode;
  condition: ExpressionNode;
  relationName?: string; // Metadata for code generation to reconstruct .joinRelation()
}
