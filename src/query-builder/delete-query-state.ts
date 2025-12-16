import { TableDef } from '../schema/table.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import {
  DeleteQueryNode,
  TableSourceNode
} from '../core/ast/query.js';
import { JoinNode } from '../core/ast/join.js';
import { createTableNode } from '../core/ast/builders.js';

/**
 * Maintains immutable state for DELETE queries
 */
export class DeleteQueryState {
  public readonly table: TableDef;
  public readonly ast: DeleteQueryNode;

  /**
   * Creates a new DeleteQueryState instance
   * @param table - The table definition for the DELETE query
   * @param ast - Optional initial AST node, defaults to a basic DELETE query
   */
  constructor(table: TableDef, ast?: DeleteQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'DeleteQuery',
      from: createTableNode(table),
      joins: []
    };
  }

  private clone(nextAst: DeleteQueryNode): DeleteQueryState {
    return new DeleteQueryState(this.table, nextAst);
  }

  /**
   * Adds a WHERE clause to the DELETE query
   * @param expr - The expression to use as the WHERE condition
   * @returns A new DeleteQueryState with the WHERE clause added
   */
  withWhere(expr: ExpressionNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  /**
   * Adds a RETURNING clause to the DELETE query
   * @param columns - The columns to return after deletion
   * @returns A new DeleteQueryState with the RETURNING clause added
   */
  withReturning(columns: ColumnNode[]): DeleteQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }

  /**
   * Adds a USING clause to the DELETE query
   * @param source - The table source to use in the USING clause
   * @returns A new DeleteQueryState with the USING clause added
   */
  withUsing(source: TableSourceNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      using: source
    });
  }

  /**
   * Adds a JOIN clause to the DELETE query
   * @param join - The join node to add
   * @returns A new DeleteQueryState with the JOIN clause added
   */
  withJoin(join: JoinNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

  /**
   * Sets an alias for the table in the DELETE query
   * @param alias - The alias to assign to the table
   * @returns A new DeleteQueryState with the table alias set
   */
  withTableAlias(alias: string): DeleteQueryState {
    return this.clone({
      ...this.ast,
      from: {
        ...this.ast.from,
        alias
      }
    });
  }
}
