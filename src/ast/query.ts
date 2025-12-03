import { ColumnNode, FunctionNode, ExpressionNode, ScalarSubqueryNode, CaseExpressionNode, WindowFunctionNode } from './expression';
import { JoinNode } from './join';
import { RelationType } from '../schema/relation';
import { OrderDirection } from '../constants/sql';

/**
 * AST node representing a table reference in a query
 */
export interface TableNode {
  type: 'Table';
  /** Table name */
  name: string;
  /** Optional schema name */
  schema?: string;
  /** Optional table alias */
  alias?: string;
}

/**
 * AST node representing an ORDER BY clause
 */
export interface OrderByNode {
  type: 'OrderBy';
  /** Column to order by */
  column: ColumnNode;
  /** Order direction (ASC or DESC) */
  direction: OrderDirection;
}

/**
 * Plan for hydrating relationship data
 */
export interface HydrationRelationPlan {
  /** Name of the relationship */
  name: string;
  /** Alias prefix for the relationship */
  aliasPrefix: string;
  /** Type of relationship */
  type: RelationType;
  /** Target table name */
  targetTable: string;
  /** Target table primary key */
  targetPrimaryKey: string;
  /** Foreign key column */
  foreignKey: string;
  /** Local key column */
  localKey: string;
  /** Columns to include */
  columns: string[];
}

/**
 * Complete hydration plan for a query
 */
export interface HydrationPlan {
  /** Root table name */
  rootTable: string;
  /** Root table primary key */
  rootPrimaryKey: string;
  /** Root table columns */
  rootColumns: string[];
  /** Relationship hydration plans */
  relations: HydrationRelationPlan[];
}

/**
 * Query metadata including hydration information
 */
export interface QueryMetadata {
  /** Optional hydration plan */
  hydration?: HydrationPlan;
}

/**
 * AST node representing a Common Table Expression (CTE)
 */
export interface CommonTableExpressionNode {
  type: 'CommonTableExpression';
  /** CTE name */
  name: string;
  /** Optional column names */
  columns?: string[];
  /** CTE query */
  query: SelectQueryNode;
  /** Whether the CTE is recursive */
  recursive: boolean;
}

/**
 * AST node representing a complete SELECT query
 */
export interface SelectQueryNode {
  type: 'SelectQuery';
  /** Optional CTEs (WITH clauses) */
  ctes?: CommonTableExpressionNode[];
  /** FROM clause table */
  from: TableNode;
  /** SELECT clause columns */
  columns: (ColumnNode | FunctionNode | ScalarSubqueryNode | CaseExpressionNode | WindowFunctionNode)[];
  /** JOIN clauses */
  joins: JoinNode[];
  /** Optional WHERE clause */
  where?: ExpressionNode;
  /** Optional GROUP BY clause */
  groupBy?: ColumnNode[];
  /** Optional HAVING clause */
  having?: ExpressionNode;
  /** Optional ORDER BY clause */
  orderBy?: OrderByNode[];
  /** Optional LIMIT clause */
  limit?: number;
  /** Optional OFFSET clause */
  offset?: number;
  /** Optional query metadata */
  meta?: QueryMetadata;
  /** Optional DISTINCT clause */
  distinct?: ColumnNode[];
}
