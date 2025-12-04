import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column.js';
import { SelectQueryState } from './select-query-state.js';
import { HydrationManager } from './hydration-manager.js';
import { ColumnNode } from '../core/ast/expression.js';
import { findPrimaryKey } from './hydration-planner.js';
import { isRelationAlias } from './relation-alias.js';

/**
 * Result of a relation operation
 */
export interface RelationResult {
  /**
   * Updated query state
   */
  state: SelectQueryState;
  /**
   * Updated hydration manager
   */
  hydration: HydrationManager;
}

/**
 * Callback function for selecting columns
 */
type SelectColumnsCallback = (
  state: SelectQueryState,
  hydration: HydrationManager,
  columns: Record<string, ColumnDef>
) => RelationResult;

/**
 * Helper class for managing relation projections in queries
 */
export class RelationProjectionHelper {
  /**
   * Creates a new RelationProjectionHelper instance
   * @param table - Table definition
   * @param selectColumns - Callback for selecting columns
   */
  constructor(
    private readonly table: TableDef,
    private readonly selectColumns: SelectColumnsCallback
  ) {}

  /**
   * Ensures base projection is included in the query
   * @param state - Current query state
   * @param hydration - Hydration manager
   * @returns Relation result with updated state and hydration
   */
  ensureBaseProjection(state: SelectQueryState, hydration: HydrationManager): RelationResult {
    const primaryKey = findPrimaryKey(this.table);

    if (!this.hasBaseProjection(state)) {
      return this.selectColumns(state, hydration, this.getBaseColumns());
    }

    if (primaryKey && !this.hasPrimarySelected(state, primaryKey) && this.table.columns[primaryKey]) {
      return this.selectColumns(state, hydration, {
        [primaryKey]: this.table.columns[primaryKey]
      });
    }

    return { state, hydration };
  }

  /**
   * Checks if base projection exists in the query
   * @param state - Current query state
   * @returns True if base projection exists
   */
  private hasBaseProjection(state: SelectQueryState): boolean {
    return state.ast.columns.some(col => !isRelationAlias((col as ColumnNode).alias));
  }

  /**
   * Checks if primary key is selected in the query
   * @param state - Current query state
   * @param primaryKey - Primary key name
   * @returns True if primary key is selected
   */
  private hasPrimarySelected(state: SelectQueryState, primaryKey: string): boolean {
    return state.ast.columns.some(col => {
      const alias = (col as ColumnNode).alias;
      const name = alias || (col as ColumnNode).name;
      return !isRelationAlias(alias) && name === primaryKey;
    });
  }

  /**
   * Gets all base columns for the table
   * @returns Record of all table columns
   */
  private getBaseColumns(): Record<string, ColumnDef> {
    return Object.keys(this.table.columns).reduce((acc, key) => {
      acc[key] = (this.table.columns as Record<string, ColumnDef>)[key];
      return acc;
    }, {} as Record<string, ColumnDef>);
  }
}
