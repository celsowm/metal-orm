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

/**
 * Allowed literal type names - single source of truth for both type and error messages
 */
const LITERAL_VALUE_TYPES = ['string', 'number', 'boolean', 'Date', 'null'] as const;

/**
 * Literal values that can be used in UPDATE statements
 * Derived from LITERAL_VALUE_TYPES to maintain single source of truth
 */
type LiteralValue = typeof LITERAL_VALUE_TYPES[number] | null;

/**
 * Values allowed in UPDATE SET clauses
 */
type UpdateValue = OperandNode | LiteralValue;

/**
 * Type guard to check if a value is valid for UPDATE operations
 * @param value - Value to check
 * @returns True if value is a valid update value
 */
const isUpdateValue = (value: unknown): value is UpdateValue => {
  if (value === null) return true;
  if (value instanceof Date) return true;
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

  /**
   * Creates a new UpdateQueryState instance
   * @param table - Table definition for the update
   * @param ast - Optional existing AST
   */
  constructor(table: TableDef, ast?: UpdateQueryNode) {
    this.table = table;
    this.ast = ast ?? {
      type: 'UpdateQuery',
      table: createTableNode(table),
      set: [],
      joins: []
    };
  }

  /**
   * Creates a new UpdateQueryState with updated AST
   * @param nextAst - Updated AST
   * @returns New UpdateQueryState instance
   */
  private clone(nextAst: UpdateQueryNode): UpdateQueryState {
    return new UpdateQueryState(this.table, nextAst);
  }

  /**
   * Sets the columns to update with their new values
   * @param values - Record of column names to values
   * @returns New UpdateQueryState with SET clause
   */
  withSet(values: Record<string, unknown>): UpdateQueryState {
    const assignments: UpdateAssignmentNode[] = Object.entries(values).map(([column, rawValue]) => {
      if (!isUpdateValue(rawValue)) {
        const allowedTypes = [...LITERAL_VALUE_TYPES, 'OperandNode'];
        throw new Error(
          `Invalid update value for column "${column}": only ${allowedTypes.join(', ')} are allowed`
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

  /**
   * Adds a WHERE condition to the update query
   * @param expr - WHERE expression
   * @returns New UpdateQueryState with WHERE clause
   */
  withWhere(expr: ExpressionNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  /**
   * Adds a RETURNING clause to the update query
   * @param columns - Columns to return
   * @returns New UpdateQueryState with RETURNING clause
   */
  withReturning(columns: ColumnNode[]): UpdateQueryState {
    return this.clone({
      ...this.ast,
      returning: [...columns]
    });
  }

  /**
   * Sets the FROM clause for the update query
   * @param from - Table source for FROM
   * @returns New UpdateQueryState with FROM clause
   */
  withFrom(from: TableSourceNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      from
    });
  }

  /**
   * Adds a JOIN to the update query
   * @param join - Join node to add
   * @returns New UpdateQueryState with JOIN
   */
  withJoin(join: JoinNode): UpdateQueryState {
    return this.clone({
      ...this.ast,
      joins: [...(this.ast.joins ?? []), join]
    });
  }

  /**
   * Applies an alias to the table being updated
   * @param alias - Alias for the table
   * @returns New UpdateQueryState with table alias
   */
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
