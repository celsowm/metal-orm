import { TableDef } from '../schema/table';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { QueryAstService } from './query-ast-service';
import { RelationService } from './relation-service';

/**
 * Context for query building operations
 */
export interface SelectQueryBuilderContext {
  /**
   * Current query state
   */
  readonly state: SelectQueryState;
  /**
   * Hydration manager for the query
   */
  readonly hydration: HydrationManager;
}

/**
 * Dependencies for query builder operations
 */
export interface SelectQueryBuilderDependencies {
  /**
   * Creates a new query state
   * @param table - Table definition
   * @returns New query state
   */
  createState: (table: TableDef) => SelectQueryState;
  /**
   * Creates a new hydration manager
   * @param table - Table definition
   * @returns New hydration manager
   */
  createHydration: (table: TableDef) => HydrationManager;
  /**
   * Creates a new query AST service
   * @param table - Table definition
   * @param state - Query state
   * @returns New query AST service
   */
  createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService;
  /**
   * Creates a new relation service
   * @param table - Table definition
   * @param state - Query state
   * @param hydration - Hydration manager
   * @returns New relation service
   */
  createRelationService: (
    table: TableDef,
    state: SelectQueryState,
    hydration: HydrationManager
  ) => RelationService;
}

/**
 * Environment for query builder operations
 */
export interface SelectQueryBuilderEnvironment {
  /**
   * Table definition
   */
  readonly table: TableDef;
  /**
   * Query builder dependencies
   */
  readonly deps: SelectQueryBuilderDependencies;
}

/**
 * Default implementation of query builder dependencies
 */
export const defaultSelectQueryBuilderDependencies: SelectQueryBuilderDependencies = {
  createState: table => new SelectQueryState(table),
  createHydration: table => new HydrationManager(table),
  createQueryAstService: (table, state) => new QueryAstService(table, state),
  createRelationService: (table, state, hydration) => new RelationService(table, state, hydration)
};
