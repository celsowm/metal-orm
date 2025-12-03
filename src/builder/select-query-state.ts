import { TableDef } from '../schema/table';
import { SelectQueryNode, CommonTableExpressionNode, OrderByNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode
} from '../ast/expression';
import { JoinNode } from '../ast/join';

/**
 * Node types that can be used in query projections
 */
export type ProjectionNode =
  | ColumnNode
  | FunctionNode
  | ScalarSubqueryNode
  | CaseExpressionNode
  | WindowFunctionNode;

/**
 * Manages the state of a SELECT query being built
 */
export class SelectQueryState {
  /**
   * Table definition for the query
   */
  public readonly table: TableDef;
  /**
   * Abstract Syntax Tree (AST) representation of the query
   */
  public readonly ast: SelectQueryNode;

  /**
   * Creates a new SelectQueryState instance
   * @param table - Table definition
   * @param ast - Optional existing AST
   */
  constructor(table: TableDef, ast?: SelectQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'SelectQuery',
      from: { type: 'Table', name: table.name },
      columns: [],
      joins: []
    };
  }

  /**
   * Creates a new SelectQueryState with updated AST
   * @param nextAst - Updated AST
   * @returns New SelectQueryState instance
   */
  private clone(nextAst: SelectQueryNode): SelectQueryState {
    return new SelectQueryState(this.table, nextAst);
  }

  /**
   * Adds columns to the query
   * @param newCols - Columns to add
   * @returns New SelectQueryState with added columns
   */
  withColumns(newCols: ProjectionNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      columns: [...(this.ast.columns ?? []), ...newCols]
    });
  }

  /**
   * Adds a join to the query
   * @param join - Join node to add
   * @returns New SelectQueryState with added join
   */
  withJoin(join: JoinNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

  /**
   * Adds a WHERE clause to the query
   * @param predicate - WHERE predicate expression
   * @returns New SelectQueryState with WHERE clause
   */
  withWhere(predicate: ExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      where: predicate
    });
  }

  /**
   * Adds a HAVING clause to the query
   * @param predicate - HAVING predicate expression
   * @returns New SelectQueryState with HAVING clause
   */
  withHaving(predicate: ExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      having: predicate
    });
  }

  /**
   * Adds GROUP BY columns to the query
   * @param columns - Columns to group by
   * @returns New SelectQueryState with GROUP BY clause
   */
  withGroupBy(columns: ColumnNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      groupBy: [...(this.ast.groupBy ?? []), ...columns]
    });
  }

  /**
   * Adds ORDER BY clauses to the query
   * @param orderBy - ORDER BY nodes
   * @returns New SelectQueryState with ORDER BY clause
   */
  withOrderBy(orderBy: OrderByNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      orderBy: [...(this.ast.orderBy ?? []), ...orderBy]
    });
  }

  /**
   * Adds DISTINCT columns to the query
   * @param columns - Columns to make distinct
   * @returns New SelectQueryState with DISTINCT clause
   */
  withDistinct(columns: ColumnNode[]): SelectQueryState {
    return this.clone({
      ...this.ast,
      distinct: [...(this.ast.distinct ?? []), ...columns]
    });
  }

  /**
   * Adds a LIMIT clause to the query
   * @param limit - Maximum number of rows to return
   * @returns New SelectQueryState with LIMIT clause
   */
  withLimit(limit: number): SelectQueryState {
    return this.clone({
      ...this.ast,
      limit
    });
  }

  /**
   * Adds an OFFSET clause to the query
   * @param offset - Number of rows to skip
   * @returns New SelectQueryState with OFFSET clause
   */
  withOffset(offset: number): SelectQueryState {
    return this.clone({
      ...this.ast,
      offset
    });
  }

  /**
   * Adds a Common Table Expression (CTE) to the query
   * @param cte - CTE node to add
   * @returns New SelectQueryState with CTE
   */
  withCte(cte: CommonTableExpressionNode): SelectQueryState {
    return this.clone({
      ...this.ast,
      ctes: [...(this.ast.ctes ?? []), cte]
    });
  }
}
