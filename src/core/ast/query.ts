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
 * AST node representing a function used as a table source (table-valued function)
 */
export interface FunctionTableNode {
  type: 'FunctionTable';
  /** Function name */
  name: string;
  /** Optional schema for the function (some dialects) */
  schema?: string;
  /** Function arguments as operand nodes */
  args?: any[]; // use any to avoid circular import here; caller should supply OperandNode
  /** Optional alias for the function table */
  alias?: string;
  /** LATERAL flag */
  lateral?: boolean;
  /** WITH ORDINALITY flag */
  withOrdinality?: boolean;
  /** Optional column aliases */
  columnAliases?: string[];
}

/**
 * AST node representing a derived table (subquery with an alias)
 */
export interface DerivedTableNode {
  type: 'DerivedTable';
  /** Subquery providing the rows */
  query: SelectQueryNode;
  /** Required alias for the derived table */
  alias: string;
  /** Optional column aliases */
  columnAliases?: string[];
}

export type TableSourceNode = TableNode | FunctionTableNode | DerivedTableNode;

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
  /** FROM clause table (either a Table or a FunctionTable) */
  from: TableSourceNode;
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
  meta?: Record<string, unknown>;
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
