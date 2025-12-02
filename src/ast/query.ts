import { ColumnNode, FunctionNode, ExpressionNode, ScalarSubqueryNode, CaseExpressionNode } from './expression';
import { JoinNode } from './join';
import { RelationType } from '../schema/relation';

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

export interface HydrationRelationPlan {
  name: string;
  aliasPrefix: string;
  type: RelationType;
  targetTable: string;
  targetPrimaryKey: string;
  foreignKey: string;
  localKey: string;
  columns: string[];
}

export interface HydrationPlan {
  rootTable: string;
  rootPrimaryKey: string;
  rootColumns: string[];
  relations: HydrationRelationPlan[];
}

export interface QueryMetadata {
  hydration?: HydrationPlan;
}

export interface CommonTableExpressionNode {
  type: 'CommonTableExpression';
  name: string;
  columns?: string[];
  query: SelectQueryNode;
  recursive: boolean;
}

export interface SelectQueryNode {
  type: 'SelectQuery';
  ctes?: CommonTableExpressionNode[];
  from: TableNode;
  columns: (ColumnNode | FunctionNode | ScalarSubqueryNode | CaseExpressionNode)[];
  joins: JoinNode[];
  where?: ExpressionNode;
  groupBy?: ColumnNode[];
  having?: ExpressionNode;
  orderBy?: OrderByNode[];
  limit?: number;
  offset?: number;
  meta?: QueryMetadata;
  distinct?: ColumnNode[];
}
