import { BinaryExpressionNode } from '../../ast/expression';
import { JoinNode } from '../../ast/join';
import { TableDef } from '../../schema/table';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';
import { JoinKind } from '../../constants/sql';

/**
 * Manages JOIN operations for query building
 */
export class JoinManager {
  /**
   * Creates a new JoinManager instance
   * @param env - Query builder environment
   */
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  /**
   * Adds a JOIN clause to the query
   * @param context - Current query context
   * @param table - Table to join
   * @param condition - Join condition expression
   * @param kind - Type of join (INNER, LEFT, RIGHT, etc.)
   * @returns Updated query context with JOIN clause
   */
  join(
    context: SelectQueryBuilderContext,
    table: TableDef,
    condition: BinaryExpressionNode,
    kind: JoinKind
  ): SelectQueryBuilderContext {
    const joinNode: JoinNode = {
      type: 'Join',
      kind,
      table: { type: 'Table', name: table.name },
      condition
    };
    const astService = this.env.deps.createQueryAstService(this.env.table, context.state);
    const nextState = astService.withJoin(joinNode);
    return { state: nextState, hydration: context.hydration };
  }
}
