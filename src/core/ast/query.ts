import {
  ColumnNode,
  FunctionNode,
  ExpressionNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode,
  OperandNode
} from './expression.js';
import { JoinNode } from './join.js';
import { RelationType } from '../../schema/relation.js';
import { OrderDirection } from '../sql/sql.js';

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
 * Plan describing pivot columns needed for hydration
 */
export interface HydrationPivotPlan {
  table: string;
  primaryKey: string;
  aliasPrefix: string;
  columns: string[];
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
  /** Optional pivot plan for many-to-many relationships */
  pivot?: HydrationPivotPlan;
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
 * Supported set operation kinds for compound SELECT queries
 */
export type SetOperationKind = 'UNION' | 'UNION ALL' | 'INTERSECT' | 'EXCEPT';

/**
 * AST node representing a set operation (UNION, INTERSECT, etc.)
 */
export interface SetOperationNode {
  type: 'SetOperation';
  /** Operator to combine queries */
  operator: SetOperationKind;
  /** Right-hand query in the compound expression */
  query: SelectQueryNode;
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
  /** Optional set operations chaining this query with others */
  setOps?: SetOperationNode[];
}

export interface InsertQueryNode {
  type: 'InsertQuery';
  /** Target table */
  into: TableNode;
  /** Column order for inserted values */
  columns: ColumnNode[];
  /** Rows of values to insert */
  values: OperandNode[][];
  /** Optional RETURNING clause */
  returning?: ColumnNode[];
}

export interface UpdateAssignmentNode {
  /** Column to update */
  column: ColumnNode;
  /** Value to set */
  value: OperandNode;
}

export interface UpdateQueryNode {
  type: 'UpdateQuery';
  /** Table being updated */
  table: TableNode;
  /** Assignments for SET clause */
  set: UpdateAssignmentNode[];
  /** Optional WHERE clause */
  where?: ExpressionNode;
  /** Optional RETURNING clause */
  returning?: ColumnNode[];
}

export interface DeleteQueryNode {
  type: 'DeleteQuery';
  /** Table to delete from */
  from: TableNode;
  /** Optional WHERE clause */
  where?: ExpressionNode;
  /** Optional RETURNING clause */
  returning?: ColumnNode[];
}
