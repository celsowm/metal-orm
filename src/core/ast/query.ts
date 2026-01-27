import {
  AliasRefNode,
  CaseExpressionNode,
  CastExpressionNode,
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  OperandNode,
  ScalarSubqueryNode,
  WindowFunctionNode
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
  // Canonical "intent" for dialect-aware table functions (tvf).
  // If set, compiler resolves via TableFunctionStrategy and can fail fast.
  key?: string;
  /** Function name */
  name: string;
  /** Optional schema for the function (some dialects) */
  schema?: string;
  /** Function arguments as operand nodes */
  args?: OperandNode[];
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
 * Any expression that can appear in ORDER BY / GROUP BY terms.
 */
export type OrderingTerm = OperandNode | ExpressionNode | AliasRefNode;

/**
 * AST node representing an ORDER BY clause
 */
export interface OrderByNode {
  type: 'OrderBy';
  /** Expression/operand/alias to order by */
  term: OrderingTerm;
  /** Order direction (ASC or DESC) */
  direction: OrderDirection;
  /** Optional nulls ordering (NULLS FIRST/LAST) */
  nulls?: 'FIRST' | 'LAST';
  /** Optional collation */
  collation?: string;
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
  columns: (
    ColumnNode |
    FunctionNode |
    ScalarSubqueryNode |
    CaseExpressionNode |
    CastExpressionNode |
    WindowFunctionNode
  )[];
  /** JOIN clauses */
  joins: JoinNode[];
  /** Optional WHERE clause */
  where?: ExpressionNode;
  /** Optional GROUP BY clause */
  groupBy?: OrderingTerm[];
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
  /** Optional builder-level partition by for window functions in selection */
  partitionBy?: ColumnNode[];
  /** Optional set operations chaining this query with others */
  setOps?: SetOperationNode[];
}

export interface InsertValuesSourceNode {
  type: 'InsertValues';
  /** Rows of values for INSERT rows */
  rows: OperandNode[][];
}

export interface InsertSelectSourceNode {
  type: 'InsertSelect';
  /** SELECT query providing rows */
  query: SelectQueryNode;
}

export type InsertSourceNode = InsertValuesSourceNode | InsertSelectSourceNode;

export interface InsertQueryNode {
  type: 'InsertQuery';
  /** Target table */
  into: TableNode;
  /** Column order for inserted values */
  columns: ColumnNode[];
  /** Source of inserted rows (either literal values or a SELECT query) */
  source: InsertSourceNode;
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
  /** Optional FROM clause for multi-table updates */
  from?: TableSourceNode;
  /** Optional joins applied to the FROM/USING tables */
  joins?: JoinNode[];
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
  /** Optional USING clause for multi-table deletes */
  using?: TableSourceNode;
  /** Optional joins applied to the USING clause */
  joins?: JoinNode[];
  /** Optional WHERE clause */
  where?: ExpressionNode;
  /** Optional RETURNING clause */
  returning?: ColumnNode[];
}
