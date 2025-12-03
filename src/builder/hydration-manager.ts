import { TableDef } from '../schema/table';
import { RelationDef } from '../schema/relation';
import { SelectQueryNode, HydrationPlan } from '../ast/query';
import { HydrationPlanner } from './hydration-planner';
import { SelectQueryState, ProjectionNode } from './select-query-state';

/**
 * Manages hydration planning for query results
 */
export class HydrationManager {
  /**
   * Creates a new HydrationManager instance
   * @param table - Table definition
   * @param planner - Hydration planner
   */
  constructor(
    private readonly table: TableDef,
    private readonly planner: HydrationPlanner
  ) {}

  /**
   * Creates a new HydrationManager with updated planner
   * @param nextPlanner - Updated hydration planner
   * @returns New HydrationManager instance
   */
  private clone(nextPlanner: HydrationPlanner): HydrationManager {
    return new HydrationManager(this.table, nextPlanner);
  }

  /**
   * Handles column selection for hydration planning
   * @param state - Current query state
   * @param newColumns - Newly selected columns
   * @returns Updated HydrationManager with captured columns
   */
  onColumnsSelected(state: SelectQueryState, newColumns: ProjectionNode[]): HydrationManager {
    const updated = this.planner.captureRootColumns(newColumns);
    return this.clone(updated);
  }

  /**
   * Handles relation inclusion for hydration planning
   * @param state - Current query state
   * @param relation - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for the relation
   * @param targetColumns - Target columns to include
   * @returns Updated HydrationManager with included relation
   */
  onRelationIncluded(
    state: SelectQueryState,
    relation: RelationDef,
    relationName: string,
    aliasPrefix: string,
    targetColumns: string[]
  ): HydrationManager {
    const withRoots = this.planner.captureRootColumns(state.ast.columns);
    const next = withRoots.includeRelation(relation, relationName, aliasPrefix, targetColumns);
    return this.clone(next);
  }

  /**
   * Applies hydration plan to the AST
   * @param ast - Query AST to modify
   * @returns AST with hydration metadata
   */
  applyToAst(ast: SelectQueryNode): SelectQueryNode {
    const plan = this.planner.getPlan();
    if (!plan) return ast;
    return {
      ...ast,
      meta: {
        ...(ast.meta || {}),
        hydration: plan
      }
    };
  }

  /**
   * Gets the current hydration plan
   * @returns Hydration plan or undefined if none exists
   */
  getPlan(): HydrationPlan | undefined {
    return this.planner.getPlan();
  }
}
