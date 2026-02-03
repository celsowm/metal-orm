import { TableDef } from '../schema/table.js';
import { RelationDef, RelationKinds, BelongsToManyRelation } from '../schema/relation.js';
import { ProjectionNode } from './select-query-state.js';
import { HydrationPlan, HydrationRelationPlan } from '../core/hydration/types.js';
import { isRelationAlias } from './relation-alias.js';
import { buildDefaultPivotColumns } from './relation-utils.js';

/**
 * Finds the primary key column name for a table
 * @param table - Table definition
 * @returns Name of the primary key column, defaults to 'id'
 */
export const findPrimaryKey = (table: TableDef): string => {
  const pk = Object.values(table.columns).find(c => c.primary);
  return pk?.name || 'id';
};

/**
 * Manages hydration planning for query results
 */
export class HydrationPlanner {
  /**
   * Creates a new HydrationPlanner instance
   * @param table - Table definition
   * @param plan - Optional existing hydration plan
   */
  constructor(private readonly table: TableDef, private readonly plan?: HydrationPlan) { }

  /**
   * Captures root table columns for hydration planning
   * @param columns - Columns to capture
   * @returns Updated HydrationPlanner with captured columns
   */
  captureRootColumns(columns: ProjectionNode[]): HydrationPlanner {
    const currentPlan = this.getPlanOrDefault();
    const rootCols = new Set(currentPlan.rootColumns);
    let changed = false;

    columns.forEach(node => {
      const alias = node.type === 'Column' ? (node.alias || node.name) : node.alias;
      if (!alias || isRelationAlias(alias)) return;
      if (node.type === 'Column' && node.table !== this.table.name) return;
      if (!rootCols.has(alias)) {
        rootCols.add(alias);
        changed = true;
      }
    });

    if (!changed) return this;
    return new HydrationPlanner(this.table, {
      ...currentPlan,
      rootColumns: Array.from(rootCols)
    });
  }

  /**
   * Includes a relation in the hydration plan
   * @param rel - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for relation columns
   * @param columns - Columns to include from the relation
   * @returns Updated HydrationPlanner with included relation
   */
  includeRelation(
    rel: RelationDef,
    relationName: string,
    aliasPrefix: string,
    columns: string[],
    pivot?: { aliasPrefix: string; columns: string[]; merge?: boolean }
  ): HydrationPlanner {
    const currentPlan = this.getPlanOrDefault();
    const relations = currentPlan.relations.filter(r => r.name !== relationName);
    relations.push(this.buildRelationPlan(rel, relationName, aliasPrefix, columns, pivot));
    return new HydrationPlanner(this.table, {
      ...currentPlan,
      relations
    });
  }

  /**
   * Gets the current hydration plan
   * @returns Current hydration plan or undefined
   */
  getPlan(): HydrationPlan | undefined {
    return this.plan;
  }

  /**
   * Gets the current hydration plan or creates a default one
   * @returns Current hydration plan or default plan
   */
  private getPlanOrDefault(): HydrationPlan {
    return this.plan ?? buildDefaultHydrationPlan(this.table);
  }

  /**
   * Builds a relation plan for hydration
   * @param rel - Relation definition
   * @param relationName - Name of the relation
   * @param aliasPrefix - Alias prefix for relation columns
   * @param columns - Columns to include from the relation
   * @returns Hydration relation plan
   */
  private buildRelationPlan(
    rel: RelationDef,
    relationName: string,
    aliasPrefix: string,
    columns: string[],
    pivot?: { aliasPrefix: string; columns: string[]; merge?: boolean }
  ): HydrationRelationPlan {
    switch (rel.type) {
      case RelationKinds.HasMany:
      case RelationKinds.HasOne: {
        const localKey = rel.localKey || findPrimaryKey(this.table);
        return {
          name: relationName,
          aliasPrefix,
          type: rel.type,
          targetTable: rel.target.name,
          targetPrimaryKey: findPrimaryKey(rel.target),
          foreignKey: rel.foreignKey,
          localKey,
          columns
        };
      }
      case RelationKinds.BelongsTo: {
        const localKey = rel.localKey || findPrimaryKey(rel.target);
        return {
          name: relationName,
          aliasPrefix,
          type: rel.type,
          targetTable: rel.target.name,
          targetPrimaryKey: findPrimaryKey(rel.target),
          foreignKey: rel.foreignKey,
          localKey,
          columns
        };
      }
      case RelationKinds.BelongsToMany: {
        const many = rel as BelongsToManyRelation;
        const localKey = many.localKey || findPrimaryKey(this.table);
        const targetPk = many.targetKey || findPrimaryKey(many.target);
        const pivotPk = many.pivotPrimaryKey || findPrimaryKey(many.pivotTable);
        const pivotAliasPrefix = pivot?.aliasPrefix ?? `${aliasPrefix}_pivot`;
        const pivotColumns =
          pivot?.columns ??
          many.defaultPivotColumns ??
          buildDefaultPivotColumns(many, pivotPk);

        return {
          name: relationName,
          aliasPrefix,
          type: rel.type,
          targetTable: many.target.name,
          targetPrimaryKey: targetPk,
          foreignKey: many.pivotForeignKeyToRoot,
          localKey,
          columns,
          pivot: {
            table: many.pivotTable.name,
            primaryKey: pivotPk,
            aliasPrefix: pivotAliasPrefix,
            columns: pivotColumns,
            merge: pivot?.merge
          }
        };
      }
    }
  }
}

/**
 * Builds a default hydration plan for a table
 * @param table - Table definition
 * @returns Default hydration plan
 */
const buildDefaultHydrationPlan = (table: TableDef): HydrationPlan => ({
  rootTable: table.name,
  rootPrimaryKey: findPrimaryKey(table),
  rootColumns: [],
  relations: []
});
