import { TableDef } from '../schema/table.js';
import {
  ColumnNode,
  ExpressionNode,
  OperandNode,
  isOperandNode,
  valueToOperand
} from '../core/ast/expression.js';
import {
  TableSourceNode,
  UpdateQueryNode,
  UpdateAssignmentNode
} from '../core/ast/query.js';
import { JoinNode } from '../core/ast/join.js';
import { createTableNode } from '../core/ast/builders.js';

type LiteralValue = string | number | boolean | null;
type UpdateValue = OperandNode | LiteralValue;

const isUpdateValue = (value: unknown): value is UpdateValue => {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true;
    default:
      return isOperandNode(value);
  }
};

/**
 * Immutable state for UPDATE queries
 */
export class UpdateQueryState {
  public readonly table: TableDef;
  public readonly ast: UpdateQueryNode;

  constructor(table: TableDef, ast?: UpdateQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'UpdateQuery',
      table: createTableNode(table),
      set: [],
      joins: []
    };
  }

  private clone(nextAst: UpdateQueryNode): UpdateQueryState {
    return new UpdateQueryState(this.table, nextAst);
  }

  withSet(values: Record<string, unknown>): UpdateQueryState {
    const assignments: UpdateAssignmentNode[] = Object.entries(values).map(([column, rawValue]) => {
      if (!isUpdateValue(rawValue)) {
        throw new Error(
          `Invalid update value for column "${column}": only primitives, null, or OperandNodes are allowed`
        );
      }

      return {
        column: {
          type: 'Column',
          table: this.table.name,
          name: column
        },
        value: valueToOperand(rawValue)
      };
    });

    return this.clone({
      ...this.ast,
      set: assignments
    });
  }

  withWhere(expr: ExpressionNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  withReturning(columns: ColumnNode[]): UpdateQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }

  withFrom(from: TableSourceNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      from
    });
  }

  withJoin(join: JoinNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

  withTableAlias(alias: string): UpdateQueryState {
    return this.clone({
      ...this.ast,
      table: {
        ...this.ast.table,
        alias
      }
    });
  }
}
