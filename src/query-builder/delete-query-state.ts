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

  withWhere(expr: ExpressionNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  withReturning(columns: ColumnNode[]): DeleteQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }

  withUsing(source: TableSourceNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      using: source
    });
  }

  withJoin(join: JoinNode): DeleteQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

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
