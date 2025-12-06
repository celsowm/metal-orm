import { RelationType } from '../../schema/relation.js';

/**
 * Plan describing pivot columns needed for hydration
 */
export interface HydrationPivotPlan {
  table: string;
  primaryKey: string;
  aliasPrefix: string;
  columns: string[];
}

/**
 * Plan for hydrating relationship data
 */
export interface HydrationRelationPlan {
  /** Name of the relationship */
  name: string;
  /** Alias prefix for the relationship */
  aliasPrefix: string;
  /** Type of relationship */
  type: RelationType;
  /** Target table name */
  targetTable: string;
  /** Target table primary key */
  targetPrimaryKey: string;
  /** Foreign key column */
  foreignKey: string;
  /** Local key column */
  localKey: string;
  /** Columns to include */
  columns: string[];
  /** Optional pivot plan for many-to-many relationships */
  pivot?: HydrationPivotPlan;
}

/**
 * Complete hydration plan for a query
 */
export interface HydrationPlan {
  /** Root table name */
  rootTable: string;
  /** Root table primary key */
  rootPrimaryKey: string;
  /** Root table columns */
  rootColumns: string[];
  /** Relationship hydration plans */
  relations: HydrationRelationPlan[];
}

/**
 * Metadata bag for attaching hydration to query ASTs without coupling AST types.
 */
export interface HydrationMetadata {
  hydration?: HydrationPlan;
  [key: string]: unknown;
}
