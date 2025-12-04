import { TableDef } from '../schema/table.js';
import { SelectQueryState } from './select-query-state.js';
import { HydrationManager } from './hydration-manager.js';
import { HydrationPlanner } from './hydration-planner.js';
import { QueryAstService } from './query-ast-service.js';
import { RelationService } from './relation-service.js';

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
   * Creates a new hydration planner
   * @param table - Table definition
   * @returns Hydration planner
   */
  createHydrationPlanner: (table: TableDef) => HydrationPlanner;
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
 * Default implementations for query builder dependencies
 */
const defaultCreateQueryAstService = (table: TableDef, state: SelectQueryState) => new QueryAstService(table, state);
const defaultCreateHydrationPlanner = (table: TableDef) => new HydrationPlanner(table);

const defaultCreateHydration = (table: TableDef, plannerFactory: (table: TableDef) => HydrationPlanner) =>
  new HydrationManager(table, plannerFactory(table));

/**
 * Resolves query builder dependencies by merging overrides with internal defaults
 * @param overrides - Partial overrides for dependency factories
 */
export const resolveSelectQueryBuilderDependencies = (
  overrides: Partial<SelectQueryBuilderDependencies> = {}
): SelectQueryBuilderDependencies => {
  const createQueryAstService = overrides.createQueryAstService ?? defaultCreateQueryAstService;
  const createHydrationPlanner = overrides.createHydrationPlanner ?? defaultCreateHydrationPlanner;
  const createHydration =
    overrides.createHydration ?? (table => defaultCreateHydration(table, createHydrationPlanner));
  const createRelationService =
    overrides.createRelationService ??
    ((table, state, hydration) => new RelationService(table, state, hydration, createQueryAstService));

  return {
    createState: overrides.createState ?? (table => new SelectQueryState(table)),
    createHydration,
    createHydrationPlanner,
    createQueryAstService,
    createRelationService
  };
};

export const defaultSelectQueryBuilderDependencies = resolveSelectQueryBuilderDependencies();
