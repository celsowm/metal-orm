import { TableDef } from '../schema/table.js';
import { RelationDef } from '../schema/relation.js';
import { ColumnNode, ExpressionNode } from '../core/ast/expression.js';
import { SelectQueryNode, TableNode } from '../core/ast/query.js';
import { SelectQueryState } from './select-query-state.js';
import { QueryAstService } from './query-ast-service.js';

export class RelationCteBuilder {
  constructor(
    private readonly table: TableDef,
    private readonly createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService
  ) {}

  createFilteredRelationCte(
    state: SelectQueryState,
    relationName: string,
    relation: RelationDef,
    predicate: ExpressionNode | undefined
  ): { state: SelectQueryState; table: TableNode } {
    const cteName = this.generateUniqueCteName(state, relationName);
    if (!predicate) {
      throw new Error('Unable to build filter CTE without predicates.');
    }

    const columns: ColumnNode[] = Object.keys(relation.target.columns).map(name => ({
      type: 'Column',
      table: relation.target.name,
      name
    }));

    const cteQuery: SelectQueryNode = {
      type: 'SelectQuery',
      from: { type: 'Table', name: relation.target.name, schema: relation.target.schema },
      columns,
      joins: [],
      where: predicate
    };

    const nextState = this.astService(state).withCte(cteName, cteQuery);
    const tableNode: TableNode = {
      type: 'Table',
      name: cteName,
      alias: relation.target.name
    };

    return { state: nextState, table: tableNode };
  }

  private generateUniqueCteName(state: SelectQueryState, relationName: string): string {
    const existing = new Set((state.ast.ctes ?? []).map(cte => cte.name));
    let candidate = `${relationName}__filtered`;
    let suffix = 1;
    while (existing.has(candidate)) {
      candidate = `${relationName}__filtered_${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  private astService(state: SelectQueryState): QueryAstService {
    return this.createQueryAstService(this.table, state);
  }
}
