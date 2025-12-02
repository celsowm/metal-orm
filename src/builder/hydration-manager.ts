import { TableDef } from '../schema/table';
import { RelationDef } from '../schema/relation';
import { SelectQueryNode, HydrationPlan } from '../ast/query';
import { HydrationPlanner } from './hydration-planner';
import { SelectQueryState, ProjectionNode } from './select-query-state';

export class HydrationManager {
  constructor(
    private readonly table: TableDef,
    private readonly planner?: HydrationPlanner
  ) {}

  private getPlanner(): HydrationPlanner {
    return this.planner ?? new HydrationPlanner(this.table);
  }

  private clone(nextPlanner: HydrationPlanner): HydrationManager {
    return new HydrationManager(this.table, nextPlanner);
  }

  onColumnsSelected(state: SelectQueryState, newColumns: ProjectionNode[]): HydrationManager {
    const planner = this.getPlanner();
    const updated = planner.captureRootColumns(state.ast.columns);
    return this.clone(updated);
  }

  onRelationIncluded(
    state: SelectQueryState,
    relation: RelationDef,
    relationName: string,
    aliasPrefix: string,
    targetColumns: string[]
  ): HydrationManager {
    const planner = this.getPlanner();
    const withRoots = planner.captureRootColumns(state.ast.columns);
    const next = withRoots.includeRelation(relation, relationName, aliasPrefix, targetColumns);
    return this.clone(next);
  }

  applyToAst(ast: SelectQueryNode): SelectQueryNode {
    const plan = this.planner?.getPlan();
    if (!plan) return ast;
    return {
      ...ast,
      meta: {
        ...(ast.meta || {}),
        hydration: plan
      }
    };
  }

  getPlan(): HydrationPlan | undefined {
    return this.planner?.getPlan();
  }
}
