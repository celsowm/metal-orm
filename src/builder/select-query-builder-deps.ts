import { TableDef } from '../schema/table';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { QueryAstService } from './query-ast-service';
import { RelationService } from './relation-service';

export interface SelectQueryBuilderContext {
  readonly state: SelectQueryState;
  readonly hydration: HydrationManager;
}

export interface SelectQueryBuilderDependencies {
  createState: (table: TableDef) => SelectQueryState;
  createHydration: (table: TableDef) => HydrationManager;
  createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService;
  createRelationService: (
    table: TableDef,
    state: SelectQueryState,
    hydration: HydrationManager
  ) => RelationService;
}

export interface SelectQueryBuilderEnvironment {
  readonly table: TableDef;
  readonly deps: SelectQueryBuilderDependencies;
}

export const defaultSelectQueryBuilderDependencies: SelectQueryBuilderDependencies = {
  createState: table => new SelectQueryState(table),
  createHydration: table => new HydrationManager(table),
  createQueryAstService: (table, state) => new QueryAstService(table, state),
  createRelationService: (table, state, hydration) => new RelationService(table, state, hydration)
};
