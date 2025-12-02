import { BinaryExpressionNode } from '../../ast/expression';
import { JoinNode } from '../../ast/join';
import { TableDef } from '../../schema/table';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps';

export class JoinManager {
  constructor(private readonly env: SelectQueryBuilderEnvironment) {}

  join(
    context: SelectQueryBuilderContext,
    table: TableDef,
    condition: BinaryExpressionNode,
    kind: 'INNER' | 'LEFT' | 'RIGHT'
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
