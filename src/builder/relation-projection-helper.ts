import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { ColumnNode } from '../ast/expression';
import { findPrimaryKey, isRelationAlias } from './hydration-planner';

export interface RelationResult {
  state: SelectQueryState;
  hydration: HydrationManager;
}

type SelectColumnsCallback = (
  state: SelectQueryState,
  hydration: HydrationManager,
  columns: Record<string, ColumnDef>
) => RelationResult;

export class RelationProjectionHelper {
  constructor(
    private readonly table: TableDef,
    private readonly selectColumns: SelectColumnsCallback
  ) {}

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

  private hasBaseProjection(state: SelectQueryState): boolean {
    return state.ast.columns.some(col => !isRelationAlias((col as ColumnNode).alias));
  }

  private hasPrimarySelected(state: SelectQueryState, primaryKey: string): boolean {
    return state.ast.columns.some(col => {
      const alias = (col as ColumnNode).alias;
      const name = alias || (col as ColumnNode).name;
      return !isRelationAlias(alias) && name === primaryKey;
    });
  }

  private getBaseColumns(): Record<string, ColumnDef> {
    return Object.keys(this.table.columns).reduce((acc, key) => {
      acc[key] = (this.table.columns as Record<string, ColumnDef>)[key];
      return acc;
    }, {} as Record<string, ColumnDef>);
  }
}
