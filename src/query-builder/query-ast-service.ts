import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { SelectQueryNode, CommonTableExpressionNode, SetOperationKind, SetOperationNode, TableSourceNode } from '../core/ast/query.js';
import { buildColumnNode } from '../core/ast/builders.js';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  CaseExpressionNode,
  WindowFunctionNode,
  ScalarSubqueryNode,
  and,
  isExpressionSelectionNode
} from '../core/ast/expression.js';
import { JoinNode } from '../core/ast/join.js';
import { SelectQueryState, ProjectionNode } from './select-query-state.js';
import { OrderDirection } from '../core/sql/sql.js';
import { parseRawColumn } from './raw-column-parser.js';

/**
 * Result of column selection operation
 */
export interface ColumnSelectionResult {
  /**
   * Updated query state
   */
  state: SelectQueryState;
  /**
   * Columns that were added
   */
  addedColumns: ProjectionNode[];
}

/**
 * Service for manipulating query AST (Abstract Syntax Tree)
 */
export class QueryAstService {
  /**
   * Creates a new QueryAstService instance
   * @param table - Table definition
   * @param state - Current query state
   */
  constructor(private readonly table: TableDef, private readonly state: SelectQueryState) {}

  /**
   * Selects columns for the query
   * @param columns - Columns to select (key: alias, value: column definition or expression)
   * @returns Column selection result with updated state and added columns
   */
  select(
    columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>
  ): ColumnSelectionResult {
    const existingAliases = new Set(
      this.state.ast.columns.map(c => (c as ColumnNode).alias || (c as ColumnNode).name)
    );
    const from = this.state.ast.from;
    const rootTableName = from.type === 'Table' && from.alias ? from.alias : this.table.name;

    const newCols = Object.entries(columns).reduce<ProjectionNode[]>((acc, [alias, val]) => {
      if (existingAliases.has(alias)) return acc;

      if (isExpressionSelectionNode(val)) {
        acc.push({ ...(val as FunctionNode | CaseExpressionNode | WindowFunctionNode), alias } as ProjectionNode);
        return acc;
      }

      const colDef = val as ColumnDef;
      const resolvedTable =
        colDef.table && colDef.table === this.table.name && from.type === 'Table' && from.alias
          ? from.alias
          : colDef.table || rootTableName;
      acc.push({
        type: 'Column',
        table: resolvedTable,
        name: colDef.name,
        alias
      } as ColumnNode);
      return acc;
    }, []);

    const nextState = this.state.withColumns(newCols);
    return { state: nextState, addedColumns: newCols };
  }

  /**
   * Selects raw column expressions (best-effort parser for simple references/functions)
   * @param cols - Raw column expressions
   * @returns Column selection result with updated state and added columns
   */
  selectRaw(cols: string[]): ColumnSelectionResult {
    const from = this.state.ast.from;
    const defaultTable = from.type === 'Table' && from.alias ? from.alias : this.table.name;
    const newCols = cols.map(col => parseRawColumn(col, defaultTable, this.state.ast.ctes));
    const nextState = this.state.withColumns(newCols);
    return { state: nextState, addedColumns: newCols };
  }

  /**
   * Adds a Common Table Expression (CTE) to the query
   * @param name - Name of the CTE
   * @param query - Query for the CTE
   * @param columns - Optional column names for the CTE
   * @param recursive - Whether the CTE is recursive
   * @returns Updated query state with CTE
   */
  withCte(name: string, query: SelectQueryNode, columns?: string[], recursive = false): SelectQueryState {
    const cte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name,
      query,
      columns,
      recursive
    };

    return this.state.withCte(cte);
  }

  /**
   * Adds a set operation (UNION/UNION ALL/INTERSECT/EXCEPT) to the query
   * @param operator - Set operator
   * @param query - Right-hand side query
   * @returns Updated query state with set operation
   */
  withSetOperation(operator: SetOperationKind, query: SelectQueryNode): SelectQueryState {
    const op: SetOperationNode = {
      type: 'SetOperation',
      operator,
      query
    };
    return this.state.withSetOperation(op);
  }

  /**
   * Replaces the FROM clause for the current query.
   * @param from - Table source to use in the FROM clause
   * @returns Updated query state with new FROM
   */
  withFrom(from: TableSourceNode): SelectQueryState {
    return this.state.withFrom(from);
  }

  /**
   * Selects a subquery as a column
   * @param alias - Alias for the subquery
   * @param query - Subquery to select
   * @returns Updated query state with subquery selection
   */
  selectSubquery(alias: string, query: SelectQueryNode): SelectQueryState {
    const node: ScalarSubqueryNode = { type: 'ScalarSubquery', query, alias };
    return this.state.withColumns([node]);
  }

  /**
   * Adds a JOIN clause to the query
   * @param join - Join node to add
   * @returns Updated query state with JOIN
   */
  withJoin(join: JoinNode): SelectQueryState {
    return this.state.withJoin(join);
  }

  /**
   * Adds a WHERE clause to the query
   * @param expr - Expression for the WHERE clause
   * @returns Updated query state with WHERE clause
   */
  withWhere(expr: ExpressionNode): SelectQueryState {
    const combined = this.combineExpressions(this.state.ast.where, expr);
    return this.state.withWhere(combined);
  }

  /**
   * Adds a GROUP BY clause to the query
   * @param col - Column to group by
   * @returns Updated query state with GROUP BY clause
   */
  withGroupBy(col: ColumnDef | ColumnNode): SelectQueryState {
    const from = this.state.ast.from;
    const tableRef = from.type === 'Table' && from.alias ? { ...this.table, alias: from.alias } : this.table;
    const node = buildColumnNode(tableRef, col);
    return this.state.withGroupBy([node]);
  }

  /**
   * Adds a HAVING clause to the query
   * @param expr - Expression for the HAVING clause
   * @returns Updated query state with HAVING clause
   */
  withHaving(expr: ExpressionNode): SelectQueryState {
    const combined = this.combineExpressions(this.state.ast.having, expr);
    return this.state.withHaving(combined);
  }

  /**
   * Adds an ORDER BY clause to the query
   * @param col - Column to order by
   * @param direction - Order direction (ASC/DESC)
   * @returns Updated query state with ORDER BY clause
   */
  withOrderBy(col: ColumnDef | ColumnNode, direction: OrderDirection): SelectQueryState {
    const from = this.state.ast.from;
    const tableRef = from.type === 'Table' && from.alias ? { ...this.table, alias: from.alias } : this.table;
    const node = buildColumnNode(tableRef, col);
    return this.state.withOrderBy([{ type: 'OrderBy', column: node, direction }]);
  }

  /**
   * Adds a DISTINCT clause to the query
   * @param cols - Columns to make distinct
   * @returns Updated query state with DISTINCT clause
   */
  withDistinct(cols: ColumnNode[]): SelectQueryState {
    return this.state.withDistinct(cols);
  }

  /**
   * Adds a LIMIT clause to the query
   * @param limit - Maximum number of rows to return
   * @returns Updated query state with LIMIT clause
   */
  withLimit(limit: number): SelectQueryState {
    return this.state.withLimit(limit);
  }

  /**
   * Adds an OFFSET clause to the query
   * @param offset - Number of rows to skip
   * @returns Updated query state with OFFSET clause
   */
  withOffset(offset: number): SelectQueryState {
    return this.state.withOffset(offset);
  }

  /**
   * Combines expressions with AND operator
   * @param existing - Existing expression
   * @param next - New expression to combine
   * @returns Combined expression
   */
  private combineExpressions(existing: ExpressionNode | undefined, next: ExpressionNode): ExpressionNode {
    return existing ? and(existing, next) : next;
  }

}
